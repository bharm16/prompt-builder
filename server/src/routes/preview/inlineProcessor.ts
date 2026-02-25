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
  const leaseSeconds = Number.parseInt(process.env.VIDEO_JOB_LEASE_SECONDS || '60', 10);
  if (!Number.isFinite(leaseSeconds) || leaseSeconds <= 0) {
    return 60000;
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
        if (!storageService) {
          throw new Error('Storage service unavailable for required durable write');
        }

        const storageResult: {
          storagePath: string;
          viewUrl: string;
          expiresAt: string;
          sizeBytes: number;
        } = await storageService.saveFromUrl(claimed.userId, result.videoUrl, 'generation', {
          model: claimed.request.options?.model,
          creditsUsed: claimed.creditsReserved,
        });

        logger.info('Required storage copy completed', {
          persistence_type: 'durable-storage',
          required: true,
          outcome: 'success',
          job_id: jobId,
          user_id: claimed.userId,
          storage_path: storageResult.storagePath,
        });

        const resultWithStorage = {
          ...result,
          storagePath: storageResult.storagePath,
          viewUrl: storageResult.viewUrl,
          viewUrlExpiresAt: storageResult.expiresAt,
          sizeBytes: storageResult.sizeBytes,
        };

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

        const marked = await videoJobStore.markFailed(jobId, {
          message: errorMessage,
          code: 'VIDEO_JOB_INLINE_FAILED',
          category: 'infrastructure',
          retryable: false,
          stage: 'generation',
          attempt: claimed.attempts,
        });
        if (marked) {
          await videoJobStore.enqueueDeadLetter(
            claimed,
            {
              message: errorMessage,
              code: 'VIDEO_JOB_INLINE_FAILED',
              category: 'infrastructure',
              retryable: false,
              stage: 'generation',
              attempt: claimed.attempts,
            },
            'inline-terminal'
          );
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
