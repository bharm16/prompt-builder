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
  private readonly sweepIntervalMs: number;
  private readonly maxJobsPerRun: number;
  private readonly metrics?: VideoJobSweeperOptions['metrics'];
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
    this.metrics = options.metrics;
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
        this.metrics?.recordAlert('video_job_sweeper_stale_reclaimed', { processed });
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

export function createVideoJobSweeper(
  jobStore: VideoJobStore,
  userCreditService: UserCreditService,
  metrics?: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  }
): VideoJobSweeper | null {
  const disabled = process.env.VIDEO_JOB_SWEEPER_DISABLED === 'true';
  if (disabled) {
    return null;
  }

  const queueTimeoutSecondsRaw = Number.parseInt(
    process.env.VIDEO_JOB_STALE_QUEUE_SECONDS || '',
    10
  );
  const queueTimeoutMinutesRaw = Number.parseInt(process.env.VIDEO_JOB_STALE_QUEUE_MINUTES || '', 10);
  const queueTimeoutSeconds = Number.isFinite(queueTimeoutSecondsRaw)
    ? queueTimeoutSecondsRaw
    : Number.isFinite(queueTimeoutMinutesRaw)
      ? queueTimeoutMinutesRaw * 60
      : DEFAULT_QUEUE_TIMEOUT_SECONDS;
  const processingGraceSecondsRaw = Number.parseInt(
    process.env.VIDEO_JOB_STALE_PROCESSING_SECONDS || '',
    10
  );
  const processingGraceMinutesRaw = Number.parseInt(
    process.env.VIDEO_JOB_STALE_PROCESSING_MINUTES || '',
    10
  );
  const processingGraceSeconds = Number.isFinite(processingGraceSecondsRaw)
    ? processingGraceSecondsRaw
    : Number.isFinite(processingGraceMinutesRaw)
      ? processingGraceMinutesRaw * 60
      : DEFAULT_PROCESSING_GRACE_SECONDS;
  const sweepIntervalSeconds = Number.parseInt(
    process.env.VIDEO_JOB_SWEEP_INTERVAL_SECONDS || String(DEFAULT_SWEEP_INTERVAL_SECONDS),
    10
  );
  const maxJobsPerRun = Number.parseInt(
    process.env.VIDEO_JOB_SWEEP_MAX || String(DEFAULT_MAX_JOBS_PER_RUN),
    10
  );

  const queueTimeoutMs = Number.isFinite(queueTimeoutSeconds) ? queueTimeoutSeconds * 1000 : 0;
  const processingGraceMs = Number.isFinite(processingGraceSeconds) ? processingGraceSeconds * 1000 : 0;
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
    ...(metrics ? { metrics } : {}),
  });
}
