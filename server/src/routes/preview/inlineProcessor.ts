import { logger } from "@infrastructure/Logger";
import type { PreviewRoutesServices } from "@routes/types";
import type { VideoJobStore } from "@services/video-generation/jobs/VideoJobStore";
import { processVideoJob } from "@services/video-generation/jobs/processVideoJob";

interface InlinePreviewProcessorParams {
  jobId: string;
  requestId?: string;
  videoJobStore: VideoJobStore;
  videoGenerationService: NonNullable<
    PreviewRoutesServices["videoGenerationService"]
  >;
  userCreditService: NonNullable<PreviewRoutesServices["userCreditService"]>;
  storageService?: NonNullable<PreviewRoutesServices["storageService"]> | null;
}

function getVideoJobLeaseMs(): number {
  const leaseSeconds = Number.parseInt(
    process.env.VIDEO_JOB_LEASE_SECONDS || "60",
    10,
  );
  if (!Number.isFinite(leaseSeconds) || leaseSeconds <= 0) {
    return 60000;
  }
  return leaseSeconds * 1000;
}

export function scheduleInlineVideoPreviewProcessing({
  jobId,
  requestId,
  videoJobStore,
  videoGenerationService,
  userCreditService,
  storageService,
}: InlinePreviewProcessorParams): void {
  const leaseMs = getVideoJobLeaseMs();
  const workerId = `inline-preview-${requestId || Date.now()}`;

  setTimeout(() => {
    void (async () => {
      const claimed = await videoJobStore.claimJob(jobId, workerId, leaseMs);
      if (!claimed) {
        logger.debug("Inline preview job claim skipped", {
          jobId,
          workerId,
        });
        return;
      }

      logger.info("Inline preview job claimed", {
        jobId,
        workerId,
        userId: claimed.userId,
      });

      await processVideoJob(claimed, {
        jobStore: videoJobStore,
        videoGenerationService: videoGenerationService as never,
        storageService: storageService ?? null,
        userCreditService,
        workerId,
        leaseMs,
        dlqSource: "inline-terminal",
        refundReason: "inline video preview failed",
        logPrefix: "Inline preview job",
      });
    })();
  }, 300);
}
