import { logger } from '@infrastructure/Logger';
import type { UserCreditService } from '@services/credits/UserCreditService';
import { buildRefundKey, refundWithGuard } from '@services/credits/refundGuard';
import type { VideoJobRecord } from './types';
import { VideoJobStore } from './VideoJobStore';

const DEFAULT_QUEUE_TIMEOUT_MINUTES = 30;
const DEFAULT_PROCESSING_GRACE_MINUTES = 30;
const DEFAULT_SWEEP_INTERVAL_SECONDS = 60;
const DEFAULT_MAX_JOBS_PER_RUN = 25;

interface VideoJobSweeperOptions {
  queueTimeoutMs: number;
  processingGraceMs: number;
  sweepIntervalMs: number;
  maxJobsPerRun: number;
}

export class VideoJobSweeper {
  private readonly jobStore: VideoJobStore;
  private readonly userCreditService: UserCreditService;
  private readonly queueTimeoutMs: number;
  private readonly processingGraceMs: number;
  private readonly sweepIntervalMs: number;
  private readonly maxJobsPerRun: number;
  private readonly log = logger.child({ service: 'VideoJobSweeper' });
  private timer: NodeJS.Timeout | null = null;
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
    this.sweepIntervalMs = options.sweepIntervalMs;
    this.maxJobsPerRun = options.maxJobsPerRun;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.sweepIntervalMs);

    void this.runOnce();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runOnce(): Promise<void> {
    if (this.running) {
      return;
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
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Failed to sweep stale video jobs', { error: errorMessage });
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

export function createVideoJobSweeper(
  jobStore: VideoJobStore,
  userCreditService: UserCreditService
): VideoJobSweeper | null {
  const disabled = process.env.VIDEO_JOB_SWEEPER_DISABLED === 'true';
  if (disabled) {
    return null;
  }

  const queueTimeoutMinutes = Number.parseInt(
    process.env.VIDEO_JOB_STALE_QUEUE_MINUTES || String(DEFAULT_QUEUE_TIMEOUT_MINUTES),
    10
  );
  const processingGraceMinutes = Number.parseInt(
    process.env.VIDEO_JOB_STALE_PROCESSING_MINUTES || String(DEFAULT_PROCESSING_GRACE_MINUTES),
    10
  );
  const sweepIntervalSeconds = Number.parseInt(
    process.env.VIDEO_JOB_SWEEP_INTERVAL_SECONDS || String(DEFAULT_SWEEP_INTERVAL_SECONDS),
    10
  );
  const maxJobsPerRun = Number.parseInt(
    process.env.VIDEO_JOB_SWEEP_MAX || String(DEFAULT_MAX_JOBS_PER_RUN),
    10
  );

  const queueTimeoutMs = Number.isFinite(queueTimeoutMinutes) ? queueTimeoutMinutes * 60 * 1000 : 0;
  const processingGraceMs = Number.isFinite(processingGraceMinutes) ? processingGraceMinutes * 60 * 1000 : 0;
  const sweepIntervalMs = Number.isFinite(sweepIntervalSeconds) ? sweepIntervalSeconds * 1000 : 0;
  const safeMaxJobs = Number.isFinite(maxJobsPerRun) ? maxJobsPerRun : DEFAULT_MAX_JOBS_PER_RUN;

  if (queueTimeoutMs <= 0 || processingGraceMs <= 0 || sweepIntervalMs <= 0 || safeMaxJobs <= 0) {
    return null;
  }

  return new VideoJobSweeper(jobStore, userCreditService, {
    queueTimeoutMs,
    processingGraceMs,
    sweepIntervalMs,
    maxJobsPerRun: safeMaxJobs,
  });
}
