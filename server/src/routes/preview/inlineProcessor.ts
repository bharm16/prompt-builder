import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import type { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';
import { classifyError, withStage } from '@services/video-generation/jobs/classifyError';
import { RetryPolicy } from '@server/utils/RetryPolicy';

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

      let heartbeatTimer: NodeJS.Timeout | null = null;
      try {
        // Start heartbeat to prevent sweeper from reclaiming the job
        const heartbeatIntervalMs = Math.floor(leaseMs / 3);
        heartbeatTimer = setInterval(() => {
          void videoJobStore.renewLease(jobId, workerId, leaseMs)
            .then((renewed) => {
              if (!renewed) {
                logger.warn('Inline preview heartbeat skipped (lease lost)', {
                  jobId,
                  workerId,
                });
              }
            })
            .catch((err) => {
              logger.warn('Inline preview heartbeat failed', {
                jobId,
                workerId,
                error: err instanceof Error ? err.message : String(err),
              });
            });
        }, heartbeatIntervalMs);

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

        let marked = false;
        try {
          marked = await RetryPolicy.execute(
            () => videoJobStore.markCompleted(jobId, resultWithStorage),
            {
              maxRetries: 2,
              getDelayMs: (attempt) => 100 * 2 ** (attempt - 1),
              logRetries: true,
            }
          );
        } catch (retryError) {
          logger.error('Inline markCompleted failed after retries — video stored but job not updated', retryError instanceof Error ? retryError : undefined, {
            jobId,
            workerId,
            userId: claimed.userId,
            storagePath: storageResult.storagePath,
            assetId: result.assetId,
          });
        }

        if (!marked) {
          logger.error('Inline preview completion failed — refunding credits', undefined, {
            jobId,
            workerId,
            userId: claimed.userId,
            storagePath: storageResult.storagePath,
            assetId: result.assetId,
            recovery: 'manual — asset exists at storagePath',
          });
          const refundKey = buildRefundKey(['video-job', jobId, 'video']);
          await refundWithGuard({
            userCreditService,
            userId: claimed.userId,
            amount: claimed.creditsReserved,
            refundKey,
            reason: 'inline markCompleted failed after retries',
            metadata: {
              jobId,
              workerId,
              storagePath: storageResult.storagePath,
            },
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
        const stageAware = withStage(error, 'generation');
        const classifiedError = classifyError(stageAware, {
          request: claimed.request,
          attempts: claimed.attempts,
        });

        const errorInstance = error instanceof Error ? error : new Error(classifiedError.message);
        logger.error('Inline preview job failed', errorInstance, {
          jobId,
          workerId,
          userId: claimed.userId,
          errorMessage: classifiedError.message,
          retryable: classifiedError.retryable,
          category: classifiedError.category,
        });

        const hasAttemptsRemaining = claimed.attempts < claimed.maxAttempts;
        if (classifiedError.retryable && hasAttemptsRemaining) {
          const requeued = await videoJobStore.requeueForRetry(jobId, workerId, classifiedError);
          if (requeued) {
            logger.info('Inline preview job requeued for retry', {
              jobId,
              workerId,
              userId: claimed.userId,
              attempt: claimed.attempts,
              maxAttempts: claimed.maxAttempts,
            });
          } else {
            logger.warn('Inline preview job requeue skipped (status changed)', {
              jobId,
              workerId,
              userId: claimed.userId,
            });
          }
          return;
        }

        const terminalError = {
          ...classifiedError,
          retryable: false,
        };
        const marked = await videoJobStore.markFailed(jobId, terminalError);
        if (marked) {
          await videoJobStore.enqueueDeadLetter(
            claimed,
            terminalError,
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
      } finally {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
      }
    })();
  }, 300);
}
