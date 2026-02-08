import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForVideoJob } from '../videoJobs';
import { getVideoPreviewStatus } from '@/features/preview/api/previewApi';
import type { VideoJobStatusResponse } from '@/features/preview/api/previewApi';

vi.mock('@/features/preview/api/previewApi', () => ({
  getVideoPreviewStatus: vi.fn(),
}));

const mockStatusResponse = (
  overrides: Partial<VideoJobStatusResponse> = {}
): VideoJobStatusResponse => ({
  success: true,
  jobId: 'job-123',
  status: 'processing',
  ...overrides,
});

describe('waitForVideoJob', () => {
  let abortController: AbortController;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    abortController = new AbortController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('throws when status response indicates failure', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({ success: false, error: 'Invalid job ID' })
      );

      // Use Promise.all to advance timers and catch rejection simultaneously
      await expect(
        Promise.all([
          waitForVideoJob('job-123', abortController.signal),
          vi.advanceTimersByTimeAsync(0),
        ])
      ).rejects.toThrow('Invalid job ID');
    });

    it('uses message field when error field is missing', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue({
        ...mockStatusResponse({ success: false }),
        message: 'Job not found',
      } as VideoJobStatusResponse);

      await expect(
        Promise.all([
          waitForVideoJob('job-123', abortController.signal),
          vi.advanceTimersByTimeAsync(0),
        ])
      ).rejects.toThrow('Job not found');
    });

    it('throws fallback message when no error details provided', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({ success: false })
      );

      await expect(
        Promise.all([
          waitForVideoJob('job-123', abortController.signal),
          vi.advanceTimersByTimeAsync(0),
        ])
      ).rejects.toThrow('Failed to fetch video status');
    });

    it('throws when video generation failed', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({ status: 'failed', error: 'GPU allocation failed' })
      );

      await expect(
        Promise.all([
          waitForVideoJob('job-123', abortController.signal),
          vi.advanceTimersByTimeAsync(0),
        ])
      ).rejects.toThrow('GPU allocation failed');
    });

    it('throws fallback message when generation failed without error details', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({ status: 'failed' })
      );

      await expect(
        Promise.all([
          waitForVideoJob('job-123', abortController.signal),
          vi.advanceTimersByTimeAsync(0),
        ])
      ).rejects.toThrow('Video generation failed');
    });

    it('throws when completed but no URL returned', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({ status: 'completed' })
      );

      await expect(
        Promise.all([
          waitForVideoJob('job-123', abortController.signal),
          vi.advanceTimersByTimeAsync(0),
        ])
      ).rejects.toThrow('Video generation completed but no URL was returned');
    });

    it('throws timeout error after MAX_WAIT_MS (6 minutes)', async () => {
      const MAX_WAIT_MS = 6 * 60 * 1000;
      const POLL_INTERVAL_MS = 2000;
      const pollsNeeded = Math.ceil(MAX_WAIT_MS / POLL_INTERVAL_MS) + 1;

      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({ status: 'processing' })
      );

      const promise = waitForVideoJob('job-123', abortController.signal);

      // Advance time in smaller chunks to allow polling to happen
      // Use Promise.race to catch rejection as soon as it happens
      let caught = false;
      const catchPromise = promise.catch((error: Error) => {
        caught = true;
        expect(error.message).toBe('Timed out waiting for video generation');
      });

      for (let i = 0; i < pollsNeeded && !caught; i++) {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      }

      await catchPromise;
      expect(caught).toBe(true);
    }, 15000); // Increase test timeout
  });

  describe('edge cases', () => {
    it('returns null immediately when signal is already aborted', async () => {
      abortController.abort();

      const result = await waitForVideoJob('job-123', abortController.signal);

      expect(result).toBeNull();
      expect(getVideoPreviewStatus).not.toHaveBeenCalled();
    });

    it('returns null when aborted during polling', async () => {
      let callCount = 0;
      vi.mocked(getVideoPreviewStatus).mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          abortController.abort();
        }
        return mockStatusResponse({ status: 'processing' });
      });

      const promise = waitForVideoJob('job-123', abortController.signal);

      // First poll
      await vi.advanceTimersByTimeAsync(0);
      // Second poll (abort happens here)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBeNull();
    });

    it('polls every 2 seconds until completion', async () => {
      let callCount = 0;
      vi.mocked(getVideoPreviewStatus).mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return mockStatusResponse({ status: 'processing' });
        }
        return mockStatusResponse({
          status: 'completed',
          videoUrl: 'https://example.com/video.mp4',
        });
      });

      const promise = waitForVideoJob('job-123', abortController.signal);

      // Initial call
      await vi.advanceTimersByTimeAsync(0);
      expect(getVideoPreviewStatus).toHaveBeenCalledTimes(1);

      // After 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(getVideoPreviewStatus).toHaveBeenCalledTimes(2);

      // After another 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(getVideoPreviewStatus).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toMatchObject({ videoUrl: 'https://example.com/video.mp4' });
    });
  });

  describe('core behavior', () => {
    it('returns video URL when generation completes', async () => {
      vi.mocked(getVideoPreviewStatus).mockResolvedValue(
        mockStatusResponse({
          status: 'completed',
          videoUrl: 'https://storage.example.com/videos/output.mp4',
        })
      );

      const promise = waitForVideoJob('job-456', abortController.signal);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toMatchObject({
        videoUrl: 'https://storage.example.com/videos/output.mp4',
      });
      expect(getVideoPreviewStatus).toHaveBeenCalledWith('job-456');
    });

    it('continues polling while status is queued or processing', async () => {
      let callIndex = 0;
      vi.mocked(getVideoPreviewStatus).mockImplementation(async () => {
        const responses: VideoJobStatusResponse[] = [
          mockStatusResponse({ status: 'queued' }),
          mockStatusResponse({ status: 'processing' }),
          mockStatusResponse({ status: 'completed', videoUrl: 'https://example.com/done.mp4' }),
        ];
        return responses[Math.min(callIndex++, responses.length - 1)]!;
      });

      const promise = waitForVideoJob('job-789', abortController.signal);

      await vi.advanceTimersByTimeAsync(0); // First call
      await vi.advanceTimersByTimeAsync(2000); // Second call
      await vi.advanceTimersByTimeAsync(2000); // Third call

      const result = await promise;
      expect(result).toMatchObject({ videoUrl: 'https://example.com/done.mp4' });
      expect(callIndex).toBe(3);
    });
  });
});
