import { getVideoPreviewStatus } from '@/features/preview/api/previewApi';
import type { VideoJobStatus } from '@/features/preview/api/previewApi';

const POLL_INTERVAL_ACTIVE_MS = 2_000;
const POLL_INTERVAL_EXTENDED_MS = 8_000;
const ACTIVE_PHASE_MS = 6 * 60 * 1_000;
const MAX_WAIT_MS = 20 * 60 * 1_000;

export interface VideoJobResult {
  videoUrl: string;
  storagePath?: string;
  viewUrl?: string;
  viewUrlExpiresAt?: string;
  assetId?: string;
}

export interface VideoJobProgressUpdate {
  status: VideoJobStatus;
  progress: number | null;
}

export async function waitForVideoJob(
  jobId: string,
  signal: AbortSignal,
  onProgress?: (update: VideoJobProgressUpdate) => void
): Promise<VideoJobResult | null> {
  const startTime = Date.now();
  while (true) {
    if (signal.aborted) return null;
    const status = await getVideoPreviewStatus(jobId);
    if (signal.aborted) return null;
    if (!status.success) {
      throw new Error(status.error || status.message || 'Failed to fetch video status');
    }

    onProgress?.({ status: status.status, progress: status.progress ?? null });

    if (status.status === 'completed' && status.videoUrl) {
      const result: VideoJobResult = {
        videoUrl: status.videoUrl,
        ...(status.storagePath !== undefined ? { storagePath: status.storagePath } : {}),
        ...(status.viewUrl !== undefined ? { viewUrl: status.viewUrl } : {}),
        ...(status.viewUrlExpiresAt !== undefined
          ? { viewUrlExpiresAt: status.viewUrlExpiresAt }
          : {}),
        ...(status.assetId !== undefined ? { assetId: status.assetId } : {}),
      };
      return result;
    }
    if (status.status === 'completed') {
      throw new Error('Video generation completed but no URL was returned');
    }
    if (status.status === 'failed') {
      throw new Error(status.error || 'Video generation failed');
    }
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > MAX_WAIT_MS) {
      throw new Error('Timed out waiting for video generation');
    }
    const interval = elapsedMs > ACTIVE_PHASE_MS
      ? POLL_INTERVAL_EXTENDED_MS
      : POLL_INTERVAL_ACTIVE_MS;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, interval);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  }
}
