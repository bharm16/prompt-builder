import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type { VideoGenerationService } from '../VideoGenerationService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';
import type { StorageService } from '@services/storage/StorageService';
import type { VideoJobError, VideoJobErrorCategory, VideoJobErrorStage, VideoJobRecord } from './types';
import { VideoJobStore } from './VideoJobStore';

interface VideoJobWorkerOptions {
  workerId?: string;
  pollIntervalMs: number;
  leaseMs: number;
  maxConcurrent: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
  heartbeatIntervalMs?: number;
  metrics?: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  };
}

interface ActiveJobContext {
  release: () => Promise<void>;
  startedAtMs: number;
}

interface StageAwareError extends Error {
  stage: VideoJobErrorStage;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function withStage(error: unknown, stage: VideoJobErrorStage): StageAwareError {
  if (error instanceof Error) {
    const stageError = error as StageAwareError;
    stageError.stage = stage;
    return stageError;
  }
  const stageError = new Error(String(error)) as StageAwareError;
  stageError.stage = stage;
  return stageError;
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class VideoJobWorker {
  private readonly jobStore: VideoJobStore;
  private readonly videoGenerationService: VideoGenerationService;
  private readonly userCreditService: UserCreditService;
  private readonly storageService: StorageService;
  private readonly basePollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly pollBackoffFactor: number;
  private readonly leaseMs: number;
  private readonly maxConcurrent: number;
  private readonly workerId: string;
  private readonly heartbeatIntervalMs: number;
  private readonly metrics?: VideoJobWorkerOptions['metrics'];
  private readonly log: ReturnType<typeof logger.child>;
  private timer: NodeJS.Timeout | null = null;
  private activeCount = 0;
  private currentPollIntervalMs: number;
  private isRunning = false;
  private isTicking = false;
  private readonly activeJobs = new Map<string, ActiveJobContext>();

  constructor(
    jobStore: VideoJobStore,
    videoGenerationService: VideoGenerationService,
    userCreditService: UserCreditService,
    storageService: StorageService,
    options: VideoJobWorkerOptions
  ) {
    this.jobStore = jobStore;
    this.videoGenerationService = videoGenerationService;
    this.userCreditService = userCreditService;
    this.storageService = storageService;
    this.basePollIntervalMs = options.pollIntervalMs;
    this.maxPollIntervalMs = options.maxPollIntervalMs ?? Math.max(this.basePollIntervalMs * 5, 10000);
    this.pollBackoffFactor = options.backoffFactor ?? 1.5;
    this.leaseMs = options.leaseMs;
    this.maxConcurrent = options.maxConcurrent;
    this.workerId = options.workerId || process.env.HOSTNAME || `video-worker-${uuidv4()}`;
    this.log = logger.child({ service: 'VideoJobWorker', workerId: this.workerId });
    this.currentPollIntervalMs = this.basePollIntervalMs;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 20_000;
    this.metrics = options.metrics;
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.isRunning = true;
    this.currentPollIntervalMs = this.basePollIntervalMs;
    this.log.info('Starting video job worker', {
      pollIntervalMs: this.basePollIntervalMs,
      maxPollIntervalMs: this.maxPollIntervalMs,
      leaseMs: this.leaseMs,
      maxConcurrent: this.maxConcurrent,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
    });
    this.scheduleNextTick(0);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async shutdown(drainTimeoutMs: number): Promise<void> {
    this.stop();
    const deadline = Date.now() + Math.max(1_000, drainTimeoutMs);

    while (this.activeCount > 0 && Date.now() < deadline) {
      await sleep(200);
    }

    if (this.activeCount === 0) {
      this.log.info('Video job worker drained cleanly');
      return;
    }

    this.log.warn('Video job worker drain timeout reached; releasing active jobs', {
      activeCount: this.activeCount,
      drainTimeoutMs,
    });
    this.metrics?.recordAlert('video_job_worker_drain_timeout', {
      activeCount: this.activeCount,
      drainTimeoutMs,
      workerId: this.workerId,
    });

    const releases = Array.from(this.activeJobs.entries()).map(async ([jobId, context]) => {
      try {
        await context.release();
      } catch (error) {
        this.log.error('Failed to release active job during shutdown', error as Error, {
          jobId,
          workerId: this.workerId,
        });
      }
    });

    await Promise.allSettled(releases);
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.isRunning || this.isTicking) {
      return;
    }
    this.isTicking = true;
    let claimedJobs = 0;
    let shouldScheduleNextTick = false;
    try {
      while (this.activeCount < this.maxConcurrent) {
        const job = await this.jobStore.claimNextJob(this.workerId, this.leaseMs);
        if (!job) {
          break;
        }

        claimedJobs += 1;
        this.activeCount += 1;
        void this.processJob(job).finally(() => {
          this.activeCount = Math.max(0, this.activeCount - 1);
        });
      }
    } catch (error) {
      this.log.error('Video job worker tick failed', error as Error, {
        workerId: this.workerId,
      });
    } finally {
      this.isTicking = false;
      shouldScheduleNextTick = this.isRunning;
      if (shouldScheduleNextTick) {
        if (claimedJobs === 0) {
          this.currentPollIntervalMs = Math.min(
            this.maxPollIntervalMs,
            Math.round(this.currentPollIntervalMs * this.pollBackoffFactor)
          );
        } else {
          this.currentPollIntervalMs = this.basePollIntervalMs;
        }
      }
    }

    if (shouldScheduleNextTick) {
      this.scheduleNextTick(this.currentPollIntervalMs);
    }
  }

  private classifyError(error: StageAwareError, job: VideoJobRecord): VideoJobError {
    const message = normalizeErrorMessage(error);
    const lowered = message.toLowerCase();
    const stage = error.stage || 'unknown';
    const provider = typeof job.request.options?.model === 'string' ? job.request.options.model : undefined;

    let category: VideoJobErrorCategory = 'unknown';
    let code = 'VIDEO_JOB_FAILED';
    let retryable = true;

    if (stage === 'persistence') {
      category = 'storage';
      code = 'VIDEO_JOB_STORAGE_FAILED';
      retryable = true;
    } else if (
      lowered.includes('timeout') ||
      lowered.includes('timed out') ||
      lowered.includes('etimedout')
    ) {
      category = 'timeout';
      code = 'VIDEO_JOB_TIMEOUT';
      retryable = true;
    } else if (
      lowered.includes('rate limit') ||
      lowered.includes('429') ||
      lowered.includes('unavailable') ||
      lowered.includes('temporar')
    ) {
      category = 'provider';
      code = 'VIDEO_JOB_PROVIDER_RETRYABLE';
      retryable = true;
    } else if (
      lowered.includes('invalid') ||
      lowered.includes('unsupported') ||
      lowered.includes('validation') ||
      lowered.includes('bad request')
    ) {
      category = 'validation';
      code = 'VIDEO_JOB_VALIDATION_FAILED';
      retryable = false;
    } else if (stage === 'generation') {
      category = 'provider';
      code = 'VIDEO_JOB_PROVIDER_FAILED';
      retryable = true;
    } else {
      category = 'infrastructure';
      code = 'VIDEO_JOB_INFRA_FAILED';
      retryable = true;
    }

    return {
      message,
      code,
      category,
      retryable,
      stage,
      ...(provider ? { provider } : {}),
      attempt: job.attempts,
    };
  }

  private async processJob(job: VideoJobRecord): Promise<void> {
    this.log.info('Processing video job', {
      jobId: job.id,
      userId: job.userId,
      status: job.status,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
    });

    let heartbeatTimer: NodeJS.Timeout | null = null;
    this.activeJobs.set(job.id, {
      startedAtMs: Date.now(),
      release: async () => {
        const released = await this.jobStore.releaseClaim(
          job.id,
          this.workerId,
          'worker shutdown before completion'
        );
        if (released) {
          await this.jobStore.enqueueDeadLetter(
            { ...job, status: 'queued' },
            {
              message: 'Job released during worker shutdown',
              code: 'VIDEO_JOB_RELEASED_ON_SHUTDOWN',
              category: 'infrastructure',
              retryable: true,
              stage: 'shutdown',
              attempt: job.attempts,
            },
            'shutdown-release'
          );
          this.metrics?.recordAlert('video_job_shutdown_release', {
            jobId: job.id,
            attempt: job.attempts,
            workerId: this.workerId,
          });
        }
      },
    });

    const startHeartbeat = () => {
      heartbeatTimer = setInterval(() => {
        void this.jobStore
          .renewLease(job.id, this.workerId, this.leaseMs)
          .then((renewed) => {
            if (!renewed) {
              this.log.warn('Video job lease heartbeat skipped', {
                jobId: job.id,
                workerId: this.workerId,
              });
            }
          })
          .catch((error) => {
            this.log.warn('Video job heartbeat failed', {
              jobId: job.id,
              workerId: this.workerId,
              error: normalizeErrorMessage(error),
            });
          });
      }, this.heartbeatIntervalMs);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    try {
      startHeartbeat();

      let result;
      try {
        result = await this.videoGenerationService.generateVideo(job.request.prompt, job.request.options);
      } catch (error) {
        throw withStage(error, 'generation');
      }

      let storageResult: {
        storagePath: string;
        viewUrl: string;
        expiresAt: string;
        sizeBytes: number;
      };
      try {
        storageResult = await this.storageService.saveFromUrl(job.userId, result.videoUrl, 'generation', {
          model: job.request.options?.model,
          creditsUsed: job.creditsReserved,
        });
      } catch (error) {
        throw withStage(error, 'persistence');
      }

      this.log.info('Required storage copy completed', {
        persistence_type: 'durable-storage',
        required: true,
        outcome: 'success',
        job_id: job.id,
        user_id: job.userId,
        storage_path: storageResult.storagePath,
      });

      const resultWithStorage = {
        ...result,
        storagePath: storageResult.storagePath,
        viewUrl: storageResult.viewUrl,
        viewUrlExpiresAt: storageResult.expiresAt,
        sizeBytes: storageResult.sizeBytes,
      };

      const marked = await this.jobStore.markCompleted(job.id, resultWithStorage);
      if (!marked) {
        this.log.warn('Video job completion skipped (status changed)', {
          jobId: job.id,
          userId: job.userId,
          assetId: result.assetId,
        });
        return;
      }

      this.log.info('Video job completed', {
        jobId: job.id,
        userId: job.userId,
        assetId: result.assetId,
      });
    } catch (error) {
      const stageAware = withStage(error, (error as StageAwareError)?.stage || 'unknown');
      const jobError = this.classifyError(stageAware, job);
      const hasAttemptsRemaining = job.attempts < job.maxAttempts;

      this.log.error('Video job attempt failed', stageAware, {
        jobId: job.id,
        userId: job.userId,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        retryable: jobError.retryable,
        category: jobError.category,
        stage: jobError.stage,
      });
      if (jobError.stage === 'persistence') {
        this.metrics?.recordAlert('video_job_persistence_failure', {
          jobId: job.id,
          attempt: job.attempts,
          code: jobError.code,
        });
      }

      if (jobError.retryable && hasAttemptsRemaining) {
        const requeued = await this.jobStore.requeueForRetry(job.id, this.workerId, jobError);
        if (requeued) {
          this.log.warn('Video job requeued for retry', {
            jobId: job.id,
            userId: job.userId,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            code: jobError.code,
          });
          this.metrics?.recordAlert('video_job_requeued', {
            jobId: job.id,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            code: jobError.code,
            category: jobError.category,
          });
          return;
        }
      }

      const terminalError: VideoJobError = {
        ...jobError,
        retryable: false,
      };

      const marked = await this.jobStore.markFailed(job.id, terminalError);
      if (marked) {
        await this.jobStore.enqueueDeadLetter(job, terminalError, 'worker-terminal');
        this.metrics?.recordAlert('video_job_terminal_failure', {
          jobId: job.id,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          code: terminalError.code,
          category: terminalError.category,
          stage: terminalError.stage,
        });
        const refundKey = buildRefundKey(['video-job', job.id, 'video']);
        await refundWithGuard({
          userCreditService: this.userCreditService,
          userId: job.userId,
          amount: job.creditsReserved,
          refundKey,
          reason: 'video job worker failed',
          metadata: {
            jobId: job.id,
            workerId: this.workerId,
            category: terminalError.category,
            code: terminalError.code,
            attempt: job.attempts,
          },
        });
      } else {
        this.log.warn('Video job failure skipped (status changed)', {
          jobId: job.id,
          userId: job.userId,
        });
      }
    } finally {
      stopHeartbeat();
      this.activeJobs.delete(job.id);
    }
  }
}
