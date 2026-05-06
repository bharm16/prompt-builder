import type { UserCreditService } from "@services/credits/UserCreditService";
import { buildRefundKey, refundWithGuard } from "@services/credits/refundGuard";
import type { VideoJobRecord } from "./types";
import { VideoJobStore } from "./VideoJobStore";
import type { ProviderCircuitManager } from "./ProviderCircuitManager";
import {
  PollingWorkerBase,
  type PollingWorkerMetrics,
} from "@services/polling/PollingWorkerBase";

interface VideoJobSweeperOptions {
  queueTimeoutMs: number;
  processingGraceMs: number;
  sweepIntervalMs: number;
  maxSweepIntervalMs?: number;
  backoffFactor?: number;
  maxJobsPerRun: number;
  providerCircuitManager?: ProviderCircuitManager;
  metrics?: PollingWorkerMetrics;
}

export class VideoJobSweeper extends PollingWorkerBase {
  private readonly jobStore: VideoJobStore;
  private readonly userCreditService: UserCreditService;
  private readonly queueTimeoutMs: number;
  private readonly processingGraceMs: number;
  private readonly maxJobsPerRun: number;
  private readonly providerCircuitManager: ProviderCircuitManager | undefined;
  private readonly sweeperMetrics: PollingWorkerMetrics | undefined;
  private running = false;

  constructor(
    jobStore: VideoJobStore,
    userCreditService: UserCreditService,
    options: VideoJobSweeperOptions,
  ) {
    super({
      workerId: "VideoJobSweeper",
      basePollIntervalMs: options.sweepIntervalMs,
      maxPollIntervalMs:
        options.maxSweepIntervalMs ??
        Math.max(options.sweepIntervalMs * 8, 120_000),
      ...(options.backoffFactor !== undefined
        ? { backoffFactor: options.backoffFactor }
        : {}),
      // Jitter the first sweep so K replica pods restarting simultaneously
      // (rolling deploy) don't all query Firestore at t=0 — avoids thundering herd.
      initialJitter: true,
      ...(options.metrics ? { metrics: options.metrics } : {}),
    });
    this.jobStore = jobStore;
    this.userCreditService = userCreditService;
    this.queueTimeoutMs = options.queueTimeoutMs;
    this.processingGraceMs = options.processingGraceMs;
    this.maxJobsPerRun = options.maxJobsPerRun;
    this.providerCircuitManager = options.providerCircuitManager;
    this.sweeperMetrics = options.metrics;
  }

  protected async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }

    this.running = true;
    try {
      const now = Date.now();
      const queueCutoff = now - this.queueTimeoutMs;
      const processingCutoff = now - this.processingGraceMs;

      let processed = 0;
      processed += await this.sweepQueued(
        queueCutoff,
        this.maxJobsPerRun - processed,
      );
      processed += await this.sweepProcessing(
        processingCutoff,
        this.maxJobsPerRun - processed,
      );

      if (processed > 0) {
        this.log.info("Stale video jobs cleaned up", { processed });
        this.sweeperMetrics?.recordAlert("video_job_sweeper_stale_reclaimed", {
          processed,
        });
      }
      this.markRunSuccess();
      return true;
    } catch (error) {
      this.markRunFailure();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log.warn("Failed to sweep stale video jobs", {
        error: errorMessage,
      });
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
        "Queued too long; credits released.",
      );
      if (!job) {
        break;
      }

      const refunded = await this.refundJobCredits(job);
      await this.jobStore.enqueueDeadLetter(
        job,
        job.error || { message: "Queued stale timeout" },
        "sweeper-stale",
        { creditsRefunded: refunded },
      );
      processed += 1;
    }

    return processed;
  }

  private async sweepProcessing(
    cutoffMs: number,
    budget: number,
  ): Promise<number> {
    let processed = 0;
    while (processed < budget) {
      const job = await this.jobStore.failNextProcessingStaleJob(
        cutoffMs,
        "Processing stalled; credits released.",
      );
      if (!job) {
        break;
      }

      const refunded = await this.refundJobCredits(job);
      await this.jobStore.enqueueDeadLetter(
        job,
        job.error || { message: "Processing stalled timeout" },
        "sweeper-stale",
        { creditsRefunded: refunded },
      );
      processed += 1;
    }

    return processed;
  }

  private async refundJobCredits(job: VideoJobRecord): Promise<boolean> {
    if (job.creditsReserved <= 0) {
      return false;
    }

    const refundKey = buildRefundKey(["video-job", job.id, "video"]);
    return await refundWithGuard({
      userCreditService: this.userCreditService,
      userId: job.userId,
      amount: job.creditsReserved,
      refundKey,
      reason: "video job sweeper stale timeout",
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
  metrics: PollingWorkerMetrics | undefined,
  config: SweeperConfig,
): VideoJobSweeper | null {
  if (config.disabled) {
    return null;
  }

  const queueTimeoutMs = config.staleQueueSeconds * 1000;
  const processingGraceMs = config.staleProcessingSeconds * 1000;
  const sweepIntervalMs = config.sweepIntervalSeconds * 1000;

  if (
    queueTimeoutMs <= 0 ||
    processingGraceMs <= 0 ||
    sweepIntervalMs <= 0 ||
    config.sweepMax <= 0
  ) {
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
