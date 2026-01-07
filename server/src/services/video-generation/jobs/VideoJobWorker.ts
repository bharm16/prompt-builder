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
}

export class VideoJobWorker {
  private readonly jobStore: VideoJobStore;
  private readonly videoGenerationService: VideoGenerationService;
  private readonly userCreditService: UserCreditService;
  private readonly pollIntervalMs: number;
  private readonly leaseMs: number;
  private readonly maxConcurrent: number;
  private readonly workerId: string;
  private readonly log: ReturnType<typeof logger.child>;
  private timer: NodeJS.Timeout | null = null;
  private activeCount = 0;

  constructor(
    jobStore: VideoJobStore,
    videoGenerationService: VideoGenerationService,
    userCreditService: UserCreditService,
    options: VideoJobWorkerOptions
  ) {
    this.jobStore = jobStore;
    this.videoGenerationService = videoGenerationService;
    this.userCreditService = userCreditService;
    this.pollIntervalMs = options.pollIntervalMs;
    this.leaseMs = options.leaseMs;
    this.maxConcurrent = options.maxConcurrent;
    this.workerId = options.workerId || process.env.HOSTNAME || `video-worker-${uuidv4()}`;
    this.log = logger.child({ service: 'VideoJobWorker', workerId: this.workerId });
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.log.info('Starting video job worker', {
      pollIntervalMs: this.pollIntervalMs,
      leaseMs: this.leaseMs,
      maxConcurrent: this.maxConcurrent,
    });
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    while (this.activeCount < this.maxConcurrent) {
      const job = await this.jobStore.claimNextJob(this.workerId, this.leaseMs);
      if (!job) {
        return;
      }

      this.activeCount += 1;
      void this.processJob(job).finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1);
      });
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
