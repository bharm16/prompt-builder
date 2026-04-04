import { pollJobStatus } from "@/features/preview/api/pollJobStatus";
import type { PollJobResult } from "@/features/preview/api/pollJobStatus";
import type { VideoJobStatus } from "@/features/preview/api/previewApi";

export type VideoJobResult = PollJobResult;

export interface VideoJobProgressUpdate {
  status: VideoJobStatus;
  progress: number | null;
}

/**
 * Wait for a video job to complete by polling the status endpoint.
 * Delegates to the shared `pollJobStatus` utility.
 */
export async function waitForVideoJob(
  jobId: string,
  signal: AbortSignal,
  onProgress?: (update: VideoJobProgressUpdate) => void,
): Promise<VideoJobResult | null> {
  return pollJobStatus(jobId, signal, { onProgress });
}
