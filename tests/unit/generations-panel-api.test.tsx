import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { compileWanPrompt } from '@features/prompt-optimizer/GenerationsPanel/api/compilePrompt';
import { waitForVideoJob } from '@features/prompt-optimizer/GenerationsPanel/api/videoJobs';
import { promptOptimizationApiV2 } from '@/services';
import { getVideoPreviewStatus } from '@features/preview/api/previewApi';

vi.mock('@/services', () => ({
  promptOptimizationApiV2: {
    compilePrompt: vi.fn(),
  },
}));

vi.mock('@features/preview/api/previewApi', () => ({
  getVideoPreviewStatus: vi.fn(),
}));

const mockCompilePrompt = vi.mocked(promptOptimizationApiV2.compilePrompt);
const mockGetVideoPreviewStatus = vi.mocked(getVideoPreviewStatus);

const createAbortController = () => new AbortController();

describe('compileWanPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('falls back to the trimmed prompt when compilation throws', async () => {
      mockCompilePrompt.mockRejectedValue(new Error('boom'));
      const controller = createAbortController();

      const result = await compileWanPrompt('  Draft prompt  ', controller.signal);

      expect(result).toBe('Draft prompt');
      expect(mockCompilePrompt).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'Draft prompt', targetModel: 'wan' })
      );
    });

    it('returns the original prompt when the compile is aborted', async () => {
      const controller = createAbortController();
      let resolveCompile: (value: { compiledPrompt: string }) => void = () => {};

      const compilePromise = new Promise<{ compiledPrompt: string }>((resolve) => {
        resolveCompile = resolve;
      });
      mockCompilePrompt.mockReturnValue(compilePromise);

      const promise = compileWanPrompt('  Keep Me  ', controller.signal);
      controller.abort();
      resolveCompile({ compiledPrompt: '  Compiled  ' });

      await expect(promise).resolves.toBe('Keep Me');
    });
  });

  describe('edge cases', () => {
    it('ignores empty compiled prompts', async () => {
      mockCompilePrompt.mockResolvedValue({ compiledPrompt: '   ' });
      const controller = createAbortController();

      const result = await compileWanPrompt('  Fallback  ', controller.signal);

      expect(result).toBe('Fallback');
    });
  });

  describe('core behavior', () => {
    it('returns the compiled prompt when available', async () => {
      mockCompilePrompt.mockResolvedValue({ compiledPrompt: 'Compiled Prompt' });
      const controller = createAbortController();

      const result = await compileWanPrompt('  Original  ', controller.signal);

      expect(result).toBe('Compiled Prompt');
    });
  });
});

describe('waitForVideoJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('throws when the status response is unsuccessful', async () => {
      mockGetVideoPreviewStatus.mockResolvedValue({
        success: false,
        jobId: 'job-1',
        status: 'processing',
        error: 'Nope',
      });

      await expect(waitForVideoJob('job-1', new AbortController().signal)).rejects.toThrow(
        'Nope'
      );
    });

    it('throws when the job reports failure', async () => {
      mockGetVideoPreviewStatus.mockResolvedValue({
        success: true,
        jobId: 'job-1',
        status: 'failed',
        error: 'Generation failed',
      });

      await expect(waitForVideoJob('job-1', new AbortController().signal)).rejects.toThrow(
        'Generation failed'
      );
    });
  });

  describe('edge cases', () => {
    it('returns null immediately when the signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(waitForVideoJob('job-1', controller.signal)).resolves.toBeNull();
      expect(mockGetVideoPreviewStatus).not.toHaveBeenCalled();
    });

    it('times out when the job never completes', async () => {
      mockGetVideoPreviewStatus.mockResolvedValue({
        success: true,
        jobId: 'job-1',
        status: 'processing',
      });

      const promise = waitForVideoJob('job-1', new AbortController().signal);
      const rejection = expect(promise).rejects.toThrow(
        'Timed out waiting for video generation'
      );

      // Jump clock past MAX_WAIT_MS (20 min) so next poll triggers timeout
      vi.setSystemTime(20 * 60 * 1000 + 1);
      await vi.advanceTimersByTimeAsync(2000);

      await rejection;
    });
  });

  describe('core behavior', () => {
    it('returns the video url once the job is completed', async () => {
      mockGetVideoPreviewStatus
        .mockResolvedValueOnce({
          success: true,
          jobId: 'job-1',
          status: 'processing',
        })
        .mockResolvedValueOnce({
          success: true,
          jobId: 'job-1',
          status: 'completed',
          videoUrl: 'https://cdn/video.mp4',
        });

      const promise = waitForVideoJob('job-1', new AbortController().signal);

      vi.setSystemTime(2000);
      await vi.advanceTimersByTimeAsync(2000);

      await expect(promise).resolves.toMatchObject({ videoUrl: 'https://cdn/video.mp4' });
      expect(mockGetVideoPreviewStatus).toHaveBeenCalledTimes(2);
    });
  });
});
