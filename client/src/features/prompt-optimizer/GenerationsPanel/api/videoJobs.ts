import { getVideoPreviewStatus } from '@/features/preview/api/previewApi';

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 6 * 60 * 1000;

export async function waitForVideoJob(
  jobId: string,
  signal: AbortSignal
): Promise<string | null> {
  const startTime = Date.now();
  while (true) {
    if (signal.aborted) return null;
    const status = await getVideoPreviewStatus(jobId);
    if (signal.aborted) return null;
    if (!status.success) {
      throw new Error(status.error || status.message || 'Failed to fetch video status');
    }
    if (status.status === 'completed' && status.videoUrl) {
      return status.videoUrl;
    }
    if (status.status === 'completed') {
      throw new Error('Video generation completed but no URL was returned');
    }
    if (status.status === 'failed') {
      throw new Error(status.error || 'Video generation failed');
    }
    if (Date.now() - startTime > MAX_WAIT_MS) {
      throw new Error('Timed out waiting for video generation');
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, POLL_INTERVAL_MS);
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
