import { logger } from '@infrastructure/Logger';
import type { WorkerStatus } from '@services/credits/CreditRefundSweeper';
import type { VideoJobStore } from './VideoJobStore';
import type { ProviderCircuitManager } from './ProviderCircuitManager';
import type { DlqEntry } from './types';

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_MAX_POLL_INTERVAL_MS = 300_000;
const DEFAULT_BACKOFF_FACTOR = 2;
const DEFAULT_MAX_ENTRIES_PER_RUN = 5;

interface DlqReprocessorOptions {
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
  maxEntriesPerRun?: number;
  providerCircuitManager?: ProviderCircuitManager;
  metrics?: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  };
}

export class DlqReprocessorWorker {
  private readonly jobStore: VideoJobStore;
  private readonly basePollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly backoffFactor: number;
  private readonly maxEntriesPerRun: number;
  private readonly providerCircuitManager: ProviderCircuitManager | undefined;
  private readonly metrics?: DlqReprocessorOptions['metrics'];
  private readonly log = logger.child({ service: 'DlqReprocessorWorker' });
  private timer: NodeJS.Timeout | null = null;
  private currentPollIntervalMs: number;
  private started = false;
  private running = false;
  private lastRunAt: Date | null = null;
  private consecutiveFailures = 0;

  constructor(jobStore: VideoJobStore, options: DlqReprocessorOptions = {}) {
    this.jobStore = jobStore;
    this.basePollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.maxPollIntervalMs = options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS;
    this.backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
    this.maxEntriesPerRun = options.maxEntriesPerRun ?? DEFAULT_MAX_ENTRIES_PER_RUN;
    this.providerCircuitManager = options.providerCircuitManager;
    this.metrics = options.metrics;
    this.currentPollIntervalMs = this.basePollIntervalMs;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.currentPollIntervalMs = this.basePollIntervalMs;
    this.log.info('DLQ reprocessor started', {
      pollIntervalMs: this.basePollIntervalMs,
      maxEntriesPerRun: this.maxEntriesPerRun,
    });
    this.scheduleNext(this.basePollIntervalMs);
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getStatus(): WorkerStatus {
    return {
      running: this.started,
      lastRunAt: this.lastRunAt,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /** Reset poll interval to base and reschedule — used by circuit breaker recovery to resume fast polling. */
  resetPollInterval(): void {
    if (!this.started) return;
    this.currentPollIntervalMs = this.basePollIntervalMs;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.scheduleNext(this.basePollIntervalMs);
    this.log.info('Poll interval reset by circuit recovery', { pollIntervalMs: this.basePollIntervalMs });
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
      this.currentPollIntervalMs = this.basePollIntervalMs;
    } else {
      this.currentPollIntervalMs = Math.min(
        this.maxPollIntervalMs,
        Math.round(this.currentPollIntervalMs * this.backoffFactor)
      );
    }
    this.scheduleNext(this.currentPollIntervalMs);
  }

  private async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }

    this.running = true;
    let processed = 0;
    let deferred = 0;

    try {
      const now = Date.now();

      for (let i = 0; i < this.maxEntriesPerRun; i++) {
        const entry = await this.jobStore.claimNextDlqEntry(now);
        if (!entry) {
          break;
        }

        if (this.isProviderBlocked(entry)) {
          await this.deferEntry(entry, 'provider circuit open');
          deferred += 1;
          continue;
        }

        await this.reprocessEntry(entry);
        processed += 1;
      }

      if (processed > 0 || deferred > 0) {
        this.log.info('DLQ reprocessor run completed', { processed, deferred });
        this.metrics?.recordAlert('video_job_dlq_reprocessed_total', { count: processed });
      }

      this.lastRunAt = new Date();
      this.consecutiveFailures = 0;
      return true;
    } catch (error) {
      this.lastRunAt = new Date();
      this.consecutiveFailures += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('DLQ reprocessor run failed', { error: errorMessage });
      return false;
    } finally {
      this.running = false;
    }
  }

  private isProviderBlocked(entry: DlqEntry): boolean {
    if (!this.providerCircuitManager || !entry.provider || entry.provider === 'unknown') {
      return false;
    }
    return !this.providerCircuitManager.canDispatch(entry.provider);
  }

  private async deferEntry(entry: DlqEntry, reason: string): Promise<void> {
    this.log.debug('Deferring DLQ entry due to blocked provider', {
      dlqId: entry.id,
      jobId: entry.jobId,
      provider: entry.provider,
      reason,
    });

    // Move back to pending without incrementing attempt — this wasn't a real retry
    await this.jobStore.markDlqFailed(
      entry.id,
      Math.max(0, entry.dlqAttempt - 1), // keep attempt unchanged
      entry.maxDlqAttempts,
      `Deferred: ${reason}`
    );
  }

  private async reprocessEntry(entry: DlqEntry): Promise<void> {
    try {
      // Re-enqueue the job into the main queue for the worker to pick up
      await this.jobStore.createJob({
        userId: entry.userId,
        request: entry.request,
        creditsReserved: 0, // Credits were already reserved/refunded — reprocessed jobs don't reserve again
        maxAttempts: 1, // Single attempt — if it fails again, the worker will DLQ it again
      });

      await this.jobStore.markDlqReprocessed(entry.id);

      this.log.info('DLQ entry reprocessed successfully', {
        dlqId: entry.id,
        jobId: entry.jobId,
        provider: entry.provider,
        attempt: entry.dlqAttempt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('DLQ reprocess attempt failed', {
        dlqId: entry.id,
        jobId: entry.jobId,
        provider: entry.provider,
        attempt: entry.dlqAttempt,
        error: errorMessage,
      });

      await this.jobStore.markDlqFailed(
        entry.id,
        entry.dlqAttempt,
        entry.maxDlqAttempts,
        errorMessage
      );

      if (entry.dlqAttempt + 1 >= entry.maxDlqAttempts) {
        this.metrics?.recordAlert('video_job_dlq_escalated_total', {
          dlqId: entry.id,
          jobId: entry.jobId,
          provider: entry.provider,
        });
      }
    }
  }
}
