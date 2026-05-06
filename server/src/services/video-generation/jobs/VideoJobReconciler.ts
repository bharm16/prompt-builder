import type { Bucket } from "@google-cloud/storage";
import { VideoJobStore } from "./VideoJobStore";
import {
  PollingWorkerBase,
  type PollingWorkerMetrics,
} from "@services/polling/PollingWorkerBase";

const DEFAULT_ORPHAN_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_OBJECTS_PER_RUN = 50;

interface VideoJobReconcilerOptions {
  orphanThresholdMs?: number;
  reconcileIntervalMs?: number;
  maxSweepIntervalMs?: number;
  backoffFactor?: number;
  maxObjectsPerRun?: number;
  metrics?: PollingWorkerMetrics;
}

export class VideoJobReconciler extends PollingWorkerBase {
  private readonly bucket: Bucket;
  private readonly basePath: string;
  private readonly jobStore: VideoJobStore;
  private readonly orphanThresholdMs: number;
  private readonly maxObjectsPerRun: number;
  private readonly reconcilerMetrics: PollingWorkerMetrics | undefined;
  private running = false;

  constructor(
    bucket: Bucket,
    basePath: string,
    jobStore: VideoJobStore,
    options: VideoJobReconcilerOptions = {},
  ) {
    const reconcileIntervalMs =
      options.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;
    super({
      workerId: "VideoJobReconciler",
      basePollIntervalMs: reconcileIntervalMs,
      maxPollIntervalMs:
        options.maxSweepIntervalMs ??
        Math.max(reconcileIntervalMs * 8, 600_000),
      ...(options.backoffFactor !== undefined
        ? { backoffFactor: options.backoffFactor }
        : {}),
      ...(options.metrics ? { metrics: options.metrics } : {}),
    });
    this.bucket = bucket;
    this.basePath = basePath.replace(/^\/+|\/+$/g, "");
    this.jobStore = jobStore;
    this.orphanThresholdMs =
      options.orphanThresholdMs ?? DEFAULT_ORPHAN_THRESHOLD_MS;
    this.maxObjectsPerRun =
      options.maxObjectsPerRun ?? DEFAULT_MAX_OBJECTS_PER_RUN;
    this.reconcilerMetrics = options.metrics;
  }

  /**
   * Public alias for the polling base class's `runOnce`. Preserved for
   * existing callers and tests that invoke the reconciler directly without
   * going through the polling loop.
   */
  async runOnce(): Promise<boolean> {
    return this.executeReconciliation();
  }

  protected async runOnceInternal(): Promise<boolean> {
    return this.executeReconciliation();
  }

  // PollingWorkerBase requires a runOnce override. We forward to the same
  // implementation that the public runOnce uses so direct callers and the
  // polling loop share one code path.
  // The base class declares `protected abstract runOnce()` — TypeScript
  // accepts a public override that satisfies the abstract contract.

  private async executeReconciliation(): Promise<boolean> {
    if (this.running) {
      return true;
    }

    this.running = true;
    try {
      const now = Date.now();
      const cutoff = now - this.orphanThresholdMs;

      const prefix = `${this.basePath}/`;
      const [files] = await this.bucket.getFiles({ prefix });

      let processed = 0;
      let orphans = 0;

      for (const file of files) {
        if (processed >= this.maxObjectsPerRun) {
          break;
        }

        const [metadata] = await file.getMetadata();
        const createdAt = metadata.timeCreated
          ? Date.parse(metadata.timeCreated)
          : NaN;

        if (!Number.isFinite(createdAt) || createdAt > cutoff) {
          continue;
        }

        processed += 1;

        const assetId = this.extractAssetId(file.name);
        if (!assetId) {
          this.log.warn("Reconciler: could not extract assetId from GCS path", {
            fileName: file.name,
          });
          continue;
        }

        const job = await this.jobStore.findJobByAssetId(assetId);

        if (job && job.status === "completed") {
          continue;
        }

        orphans += 1;

        const context = {
          assetId,
          gcsPath: file.name,
          createdAt: metadata.timeCreated,
          jobId: job?.id,
          jobStatus: job?.status,
        };

        if (job) {
          this.log.warn(
            "Reconciler: GCS asset exists but job is not completed (possible markCompleted failure)",
            context,
          );
          this.reconcilerMetrics?.recordAlert(
            "video_reconciler_orphan_incomplete_job",
            context,
          );
        } else {
          this.log.warn(
            "Reconciler: GCS asset has no matching job record",
            context,
          );
          this.reconcilerMetrics?.recordAlert(
            "video_reconciler_orphan_no_job",
            context,
          );
        }
      }

      if (orphans > 0 || processed > 0) {
        this.log.info("Reconciliation run complete", { processed, orphans });
      }

      this.markRunSuccess();
      return true;
    } catch (error) {
      this.markRunFailure();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log.warn("Failed to reconcile video assets", {
        error: errorMessage,
      });
      return false;
    } finally {
      this.running = false;
    }
  }

  private extractAssetId(gcsPath: string): string | null {
    const prefix = `${this.basePath}/`;
    if (!gcsPath.startsWith(prefix)) {
      return null;
    }
    const assetId = gcsPath.slice(prefix.length);
    if (!assetId || assetId.includes("/")) {
      return null;
    }
    return assetId;
  }
}

interface ReconcilerConfig {
  disabled: boolean;
  orphanThresholdMs: number;
  reconcileIntervalMs: number;
  maxObjectsPerRun: number;
}

export function createVideoJobReconciler(
  bucket: Bucket,
  basePath: string,
  jobStore: VideoJobStore,
  metrics: PollingWorkerMetrics | undefined,
  config: ReconcilerConfig,
): VideoJobReconciler | null {
  if (config.disabled) {
    return null;
  }

  if (
    config.orphanThresholdMs <= 0 ||
    config.reconcileIntervalMs <= 0 ||
    config.maxObjectsPerRun <= 0
  ) {
    return null;
  }

  return new VideoJobReconciler(bucket, basePath, jobStore, {
    orphanThresholdMs: config.orphanThresholdMs,
    reconcileIntervalMs: config.reconcileIntervalMs,
    maxObjectsPerRun: config.maxObjectsPerRun,
    ...(metrics ? { metrics } : {}),
  });
}
