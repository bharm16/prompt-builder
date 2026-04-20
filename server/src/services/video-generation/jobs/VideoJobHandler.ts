import type {
  JobExecutionContext,
  JobHandler,
} from "@services/jobs/JobHandler";
import type { UserCreditService } from "@services/credits/UserCreditService";
import type { StorageService } from "@services/storage/StorageService";
import type { VideoGenerationService } from "../VideoGenerationService";
import type { ProviderCircuitManager } from "./ProviderCircuitManager";
import type { VideoJobStore } from "./VideoJobStore";
import type { VideoJobRecord } from "./types";
import { processVideoJob } from "./processVideoJob";

interface VideoJobHandlerOptions {
  providerCircuitManager?: ProviderCircuitManager;
  metrics?: {
    recordAlert: (
      alertName: string,
      metadata?: Record<string, unknown>,
    ) => void;
  };
}

/**
 * JobHandler implementation for video generation jobs.
 *
 * Wraps the existing `processVideoJob` pipeline behind the generic
 * `JobHandler<VideoJobRecord>` contract so VideoJobWorker can treat it
 * identically to future handlers (image, continuity shot, etc.).
 */
export class VideoJobHandler implements JobHandler<VideoJobRecord> {
  private readonly jobStore: VideoJobStore;
  private readonly videoGenerationService: VideoGenerationService;
  private readonly userCreditService: UserCreditService;
  private readonly storageService: StorageService;
  private readonly options: VideoJobHandlerOptions;

  constructor(
    jobStore: VideoJobStore,
    videoGenerationService: VideoGenerationService,
    userCreditService: UserCreditService,
    storageService: StorageService,
    options: VideoJobHandlerOptions = {},
  ) {
    this.jobStore = jobStore;
    this.videoGenerationService = videoGenerationService;
    this.userCreditService = userCreditService;
    this.storageService = storageService;
    this.options = options;
  }

  async process(job: VideoJobRecord, ctx: JobExecutionContext): Promise<void> {
    const { providerCircuitManager, metrics } = this.options;
    await processVideoJob(job, {
      jobStore: this.jobStore,
      videoGenerationService: this.videoGenerationService as never,
      storageService: this.storageService,
      userCreditService: this.userCreditService,
      workerId: ctx.workerId,
      leaseMs: ctx.leaseMs,
      signal: ctx.signal,
      heartbeat: ctx.heartbeat,
      dlqSource: "worker-terminal",
      refundReason: "video job worker failed",
      logPrefix: "Video job",
      ...(providerCircuitManager
        ? {
            onProviderSuccess: (provider: string) =>
              providerCircuitManager.recordSuccess(provider),
            onProviderFailure: (provider: string) =>
              providerCircuitManager.recordFailure(provider),
          }
        : {}),
      ...(metrics ? { metrics } : {}),
    });
  }
}
