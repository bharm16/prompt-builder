import type { VideoJobStore } from "./VideoJobStore";
import type { ProviderCircuitManager } from "./ProviderCircuitManager";
import type { DlqEntry } from "./types";
import {
  PollingWorkerBase,
  type PollingWorkerMetrics,
  type PollingWorkerStatus,
} from "@services/polling/PollingWorkerBase";

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
  metrics?: PollingWorkerMetrics;
}

export class DlqReprocessorWorker extends PollingWorkerBase {
  private readonly jobStore: VideoJobStore;
  private readonly maxEntriesPerRun: number;
  private readonly providerCircuitManager: ProviderCircuitManager | undefined;
  private readonly dlqMetrics: PollingWorkerMetrics | undefined;
  private running = false;

  constructor(jobStore: VideoJobStore, options: DlqReprocessorOptions = {}) {
    super({
      workerId: "DlqReprocessorWorker",
      basePollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      maxPollIntervalMs:
        options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS,
      backoffFactor: options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR,
      ...(options.metrics ? { metrics: options.metrics } : {}),
    });
    this.jobStore = jobStore;
    this.maxEntriesPerRun =
      options.maxEntriesPerRun ?? DEFAULT_MAX_ENTRIES_PER_RUN;
    this.providerCircuitManager = options.providerCircuitManager;
    this.dlqMetrics = options.metrics;
  }

  override start(): void {
    if (this.isStarted()) return;
    super.start();
    this.log.info("DLQ reprocessor started", {
      pollIntervalMs: this.basePollIntervalMs,
      maxEntriesPerRun: this.maxEntriesPerRun,
    });
  }

  override getStatus(): PollingWorkerStatus {
    // Preserves the legacy public surface (the original DLQ worker exposed
    // running/lastRunAt/consecutiveFailures via getStatus) while delegating to
    // the base class for the underlying state.
    return super.getStatus();
  }

  /** Reset poll interval to base and reschedule — used by circuit breaker recovery to resume fast polling. */
  override resetPollInterval(): void {
    if (!this.isStarted()) return;
    super.resetPollInterval();
    this.log.info("Poll interval reset by circuit recovery", {
      pollIntervalMs: this.basePollIntervalMs,
    });
  }

  protected async runOnce(): Promise<boolean> {
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
          await this.deferEntry(entry, "provider circuit open");
          deferred += 1;
          continue;
        }

        await this.reprocessEntry(entry);
        processed += 1;
      }

      if (processed > 0 || deferred > 0) {
        this.log.info("DLQ reprocessor run completed", { processed, deferred });
        this.dlqMetrics?.recordAlert("video_job_dlq_reprocessed_total", {
          count: processed,
        });
      }

      this.markRunSuccess();
      return true;
    } catch (error) {
      this.markRunFailure();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log.warn("DLQ reprocessor run failed", { error: errorMessage });
      return false;
    } finally {
      this.running = false;
    }
  }

  private isProviderBlocked(entry: DlqEntry): boolean {
    if (
      !this.providerCircuitManager ||
      !entry.provider ||
      entry.provider === "unknown"
    ) {
      return false;
    }
    return !this.providerCircuitManager.canDispatch(entry.provider);
  }

  private async deferEntry(entry: DlqEntry, reason: string): Promise<void> {
    this.log.debug("Deferring DLQ entry due to blocked provider", {
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
      `Deferred: ${reason}`,
    );
  }

  private async reprocessEntry(entry: DlqEntry): Promise<void> {
    try {
      // DLQ reprocessing always uses zero credits. The original job already
      // refunded credits on failure (or carried zero from a prior reprocess).
      // Eating the retry cost is the correct behaviour when the system failed the user.
      const creditsForReprocessedJob = 0;

      if (entry.creditsReserved > 0) {
        this.log.info(
          "DLQ reprocessing: reprocessed job carries zero credits",
          {
            dlqId: entry.id,
            jobId: entry.jobId,
            originalCredits: entry.creditsReserved,
            creditsRefunded: entry.creditsRefunded,
          },
        );
      }

      // Re-enqueue the job into the main queue for the worker to pick up
      await this.jobStore.createJob({
        userId: entry.userId,
        request: entry.request,
        creditsReserved: creditsForReprocessedJob,
        maxAttempts: 1, // Single attempt — if it fails again, the worker will DLQ it again
      });

      await this.jobStore.markDlqReprocessed(entry.id);

      this.log.info("DLQ entry reprocessed successfully", {
        dlqId: entry.id,
        jobId: entry.jobId,
        provider: entry.provider,
        attempt: entry.dlqAttempt,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log.warn("DLQ reprocess attempt failed", {
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
        errorMessage,
      );

      if (entry.dlqAttempt + 1 >= entry.maxDlqAttempts) {
        this.dlqMetrics?.recordAlert("video_job_dlq_escalated_total", {
          dlqId: entry.id,
          jobId: entry.jobId,
          provider: entry.provider,
        });
      }
    }
  }
}
