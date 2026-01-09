import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type { VideoGenerationService } from '../VideoGenerationService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { VideoJobRecord } from './types';
import { VideoJobStore } from './VideoJobStore';

interface VideoJobWorkerOptions {
  workerId?: string;
  pollIntervalMs: number;
  leaseMs: number;
  maxConcurrent: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
}

export class VideoJobWorker {
  private readonly jobStore: VideoJobStore;
  private readonly videoGenerationService: VideoGenerationService;
  private readonly userCreditService: UserCreditService;
  private readonly basePollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly pollBackoffFactor: number;
  private readonly leaseMs: number;
  private readonly maxConcurrent: number;
  private readonly workerId: string;
  private readonly log: ReturnType<typeof logger.child>;
  private timer: NodeJS.Timeout | null = null;
  private activeCount = 0;
  private currentPollIntervalMs: number;
  private isRunning = false;
  private isTicking = false;

  constructor(
    jobStore: VideoJobStore,
    videoGenerationService: VideoGenerationService,
    userCreditService: UserCreditService,
    options: VideoJobWorkerOptions
  ) {
    this.jobStore = jobStore;
    this.videoGenerationService = videoGenerationService;
    this.userCreditService = userCreditService;
    this.basePollIntervalMs = options.pollIntervalMs;
    this.maxPollIntervalMs = options.maxPollIntervalMs ?? Math.max(this.basePollIntervalMs * 5, 10000);
    this.pollBackoffFactor = options.backoffFactor ?? 1.5;
    this.leaseMs = options.leaseMs;
    this.maxConcurrent = options.maxConcurrent;
    this.workerId = options.workerId || process.env.HOSTNAME || `video-worker-${uuidv4()}`;
    this.log = logger.child({ service: 'VideoJobWorker', workerId: this.workerId });
    this.currentPollIntervalMs = this.basePollIntervalMs;
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

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) return;
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);
      this.log.error('Video job worker tick failed', errorInstance, {
        workerId: this.workerId,
      });
    } finally {
      this.isTicking = false;
      if (!this.isRunning) {
        return;
      }

      if (claimedJobs === 0) {
        this.currentPollIntervalMs = Math.min(
          this.maxPollIntervalMs,
          Math.round(this.currentPollIntervalMs * this.pollBackoffFactor)
        );
      } else {
        this.currentPollIntervalMs = this.basePollIntervalMs;
      }
      this.scheduleNextTick(this.currentPollIntervalMs);
    }
  }

  private async processJob(job: VideoJobRecord): Promise<void> {
    this.log.info('Processing video job', {
      jobId: job.id,
      userId: job.userId,
      status: job.status,
    });

    try {
      const result = await this.videoGenerationService.generateVideo(
        job.request.prompt,
        job.request.options
      );
      const marked = await this.jobStore.markCompleted(job.id, result);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);
      this.log.error('Video job failed', errorInstance, {
        jobId: job.id,
        userId: job.userId,
        errorMessage,
      });

      const marked = await this.jobStore.markFailed(job.id, errorMessage);
      if (marked) {
        await this.userCreditService.refundCredits(job.userId, job.creditsReserved);
      } else {
        this.log.warn('Video job failure skipped (status changed)', {
          jobId: job.id,
          userId: job.userId,
        });
      }
    }
  }
}
