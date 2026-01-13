import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import type { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';

interface InlinePreviewProcessorParams {
  jobId: string;
  requestId?: string;
  videoJobStore: VideoJobStore;
  videoGenerationService: NonNullable<PreviewRoutesServices['videoGenerationService']>;
  userCreditService: NonNullable<PreviewRoutesServices['userCreditService']>;
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
        const marked = await videoJobStore.markCompleted(jobId, result);
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
          await userCreditService.refundCredits(claimed.userId, claimed.creditsReserved);
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
