import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import type { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';

interface InlinePreviewProcessorParams {
  jobId: string;
  requestId?: string;
  videoJobStore: VideoJobStore;
  videoGenerationService: NonNullable<PreviewRoutesServices['videoGenerationService']>;
  userCreditService: NonNullable<PreviewRoutesServices['userCreditService']>;
  storageService?: NonNullable<PreviewRoutesServices['storageService']> | null;
}

function getVideoJobLeaseMs(): number {
  const leaseSeconds = Number.parseInt(process.env.VIDEO_JOB_LEASE_SECONDS || '900', 10);
  if (!Number.isFinite(leaseSeconds) || leaseSeconds <= 0) {
    return 900000;
  }
  return leaseSeconds * 1000;
}

export function scheduleInlineVideoPreviewProcessing({
  jobId,
  requestId,
  videoJobStore,
  videoGenerationService,
  userCreditService,
  storageService,
}: InlinePreviewProcessorParams): void {
  const leaseMs = getVideoJobLeaseMs();
  const workerId = `inline-preview-${requestId || Date.now()}`;

  setTimeout(() => {
    void (async () => {
      const claimed = await videoJobStore.claimJob(jobId, workerId, leaseMs);
      if (!claimed) {
        logger.debug('Inline preview job claim skipped', {
          jobId,
          workerId,
        });
        return;
      }

      logger.info('Inline preview job claimed', {
        jobId,
        workerId,
        userId: claimed.userId,
      });

      try {
        const result = await videoGenerationService.generateVideo(
          claimed.request.prompt,
          claimed.request.options
        );
        let storageResult: {
          storagePath: string;
          viewUrl: string;
          expiresAt: string;
          sizeBytes: number;
        } | null = null;

        if (storageService) {
          try {
            storageResult = await storageService.saveFromUrl(claimed.userId, result.videoUrl, 'generation', {
              model: claimed.request.options?.model,
              creditsUsed: claimed.creditsReserved,
            });
            logger.info('Secondary storage copy completed', {
              persistence_type: 'secondary-copy',
              required: false,
              outcome: 'success',
              job_id: jobId,
              user_id: claimed.userId,
              storage_path: storageResult.storagePath,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.info('Secondary storage copy failed', {
              persistence_type: 'secondary-copy',
              required: false,
              outcome: 'failed',
              job_id: jobId,
              user_id: claimed.userId,
              error: errorMessage,
            });
          }
        } else {
          logger.info('Secondary storage copy skipped', {
            persistence_type: 'secondary-copy',
            required: false,
            outcome: 'skipped',
            job_id: jobId,
            user_id: claimed.userId,
          });
        }

        const resultWithStorage = storageResult
          ? {
              ...result,
              storagePath: storageResult.storagePath,
              viewUrl: storageResult.viewUrl,
              viewUrlExpiresAt: storageResult.expiresAt,
              sizeBytes: storageResult.sizeBytes,
            }
          : result;

        const marked = await videoJobStore.markCompleted(jobId, resultWithStorage);
        if (!marked) {
          logger.warn('Inline preview job completion skipped (status changed)', {
            jobId,
            workerId,
            userId: claimed.userId,
            assetId: result.assetId,
          });
          return;
        }

        logger.info('Inline preview job completed', {
          jobId,
          workerId,
          userId: claimed.userId,
          assetId: result.assetId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorInstance = error instanceof Error ? error : new Error(errorMessage);
        logger.error('Inline preview job failed', errorInstance, {
          jobId,
          workerId,
          userId: claimed.userId,
          errorMessage,
        });

        const marked = await videoJobStore.markFailed(jobId, errorMessage);
        if (marked) {
          const refundKey = buildRefundKey(['video-job', jobId, 'video']);
          await refundWithGuard({
            userCreditService,
            userId: claimed.userId,
            amount: claimed.creditsReserved,
            refundKey,
            reason: 'inline video preview failed',
            metadata: {
              jobId,
              workerId,
            },
          });
        } else {
          logger.warn('Inline preview job failure skipped (status changed)', {
            jobId,
            workerId,
            userId: claimed.userId,
          });
        }
      }
    })();
  }, 300);
}
