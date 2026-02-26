import { logger } from '@infrastructure/Logger';
import type { UserCreditService } from '@services/credits/UserCreditService';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';
import type { VideoJobRecord } from './types';
import { VideoJobStore } from './VideoJobStore';

const DEFAULT_QUEUE_TIMEOUT_SECONDS = 300;
const DEFAULT_PROCESSING_GRACE_SECONDS = 90;
const DEFAULT_SWEEP_INTERVAL_SECONDS = 15;
const DEFAULT_MAX_JOBS_PER_RUN = 25;

interface VideoJobSweeperOptions {
  queueTimeoutMs: number;
  processingGraceMs: number;
  sweepIntervalMs: number;
  maxSweepIntervalMs?: number;
  backoffFactor?: number;
  maxJobsPerRun: number;
  metrics?: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  };
}

export class VideoJobSweeper {
  private readonly jobStore: VideoJobStore;
  private readonly userCreditService: UserCreditService;
  private readonly queueTimeoutMs: number;
  private readonly processingGraceMs: number;
  private readonly baseSweepIntervalMs: number;
  private readonly maxSweepIntervalMs: number;
  private readonly backoffFactor: number;
  private readonly maxJobsPerRun: number;
  private readonly metrics?: VideoJobSweeperOptions['metrics'];
  private readonly log = logger.child({ service: 'VideoJobSweeper' });
  private timer: NodeJS.Timeout | null = null;
  private currentSweepIntervalMs = 0;
  private started = false;
  private running = false;

  constructor(
    jobStore: VideoJobStore,
    userCreditService: UserCreditService,
    options: VideoJobSweeperOptions
  ) {
    this.jobStore = jobStore;
    this.userCreditService = userCreditService;
    this.queueTimeoutMs = options.queueTimeoutMs;
    this.processingGraceMs = options.processingGraceMs;
    this.baseSweepIntervalMs = options.sweepIntervalMs;
    this.maxSweepIntervalMs = options.maxSweepIntervalMs ?? Math.max(this.baseSweepIntervalMs * 8, 120_000);
    this.backoffFactor = options.backoffFactor ?? 2;
    this.maxJobsPerRun = options.maxJobsPerRun;
    this.metrics = options.metrics;
    this.currentSweepIntervalMs = this.baseSweepIntervalMs;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.currentSweepIntervalMs = this.baseSweepIntervalMs;
    this.scheduleNext(0);
  }

  private scheduleNext(delayMs: number): void {
    if (!this.started) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.runLoop();
    }, delayMs);
  }

  private async runLoop(): Promise<void> {
    if (!this.started) {
      return;
    }
    const success = await this.runOnce();
    if (success) {
      this.currentSweepIntervalMs = this.baseSweepIntervalMs;
    } else {
      this.currentSweepIntervalMs = Math.min(
        this.maxSweepIntervalMs,
        Math.round(this.currentSweepIntervalMs * this.backoffFactor)
      );
    }
    this.scheduleNext(this.currentSweepIntervalMs);
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }

    this.running = true;
    try {
      const now = Date.now();
      const queueCutoff = now - this.queueTimeoutMs;
      const processingCutoff = now - this.processingGraceMs;

      let processed = 0;
      processed += await this.sweepQueued(queueCutoff, this.maxJobsPerRun - processed);
      processed += await this.sweepProcessing(processingCutoff, this.maxJobsPerRun - processed);

      if (processed > 0) {
        this.log.info('Stale video jobs cleaned up', { processed });
        this.metrics?.recordAlert('video_job_sweeper_stale_reclaimed', { processed });
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Failed to sweep stale video jobs', { error: errorMessage });
      return false;
    } finally {
      this.running = false;
    }
  }

  private async sweepQueued(cutoffMs: number, budget: number): Promise<number> {
    let processed = 0;
    while (processed < budget) {
      const job = await this.jobStore.failNextQueuedStaleJob(
        cutoffMs,
        'Queued too long; credits released.'
      );
      if (!job) {
        break;
      }

      await this.jobStore.enqueueDeadLetter(job, job.error || { message: 'Queued stale timeout' }, 'sweeper-stale');
      await this.refundJobCredits(job);
      processed += 1;
    }

    return processed;
  }

  private async sweepProcessing(cutoffMs: number, budget: number): Promise<number> {
    let processed = 0;
    while (processed < budget) {
      const job = await this.jobStore.failNextProcessingStaleJob(
        cutoffMs,
        'Processing stalled; credits released.'
      );
      if (!job) {
        break;
      }

      await this.jobStore.enqueueDeadLetter(
        job,
        job.error || { message: 'Processing stalled timeout' },
        'sweeper-stale'
      );
      await this.refundJobCredits(job);
      processed += 1;
    }

    return processed;
  }

  private async refundJobCredits(job: VideoJobRecord): Promise<void> {
    if (job.creditsReserved <= 0) {
      return;
    }

    const refundKey = buildRefundKey(['video-job', job.id, 'video']);
    await refundWithGuard({
      userCreditService: this.userCreditService,
      userId: job.userId,
      amount: job.creditsReserved,
      refundKey,
      reason: 'video job sweeper stale timeout',
      metadata: {
        jobId: job.id,
      },
    });
  }
}

interface SweeperConfig {
  disabled: boolean;
  staleQueueSeconds: number;
  staleProcessingSeconds: number;
  sweepIntervalSeconds: number;
  sweepMax: number;
}

export function createVideoJobSweeper(
  jobStore: VideoJobStore,
  userCreditService: UserCreditService,
  metrics: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  } | undefined,
  config: SweeperConfig
): VideoJobSweeper | null {
  if (config.disabled) {
    return null;
  }

  const queueTimeoutMs = config.staleQueueSeconds * 1000;
  const processingGraceMs = config.staleProcessingSeconds * 1000;
  const sweepIntervalMs = config.sweepIntervalSeconds * 1000;

  if (queueTimeoutMs <= 0 || processingGraceMs <= 0 || sweepIntervalMs <= 0 || config.sweepMax <= 0) {
    return null;
  }

  return new VideoJobSweeper(jobStore, userCreditService, {
    queueTimeoutMs,
    processingGraceMs,
    sweepIntervalMs,
    maxSweepIntervalMs: sweepIntervalMs * 8,
    backoffFactor: 2,
    maxJobsPerRun: config.sweepMax,
    ...(metrics ? { metrics } : {}),
  });
}
