import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useGenerationActions } from '@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import {
  compileWanPrompt,
  generateStoryboardPreview,
  generateVideoPreview,
  waitForVideoJob,
} from '@features/prompt-optimizer/GenerationsPanel/api';
import {
  buildGeneration,
  resolveGenerationOptions,
} from '@features/prompt-optimizer/GenerationsPanel/utils/generationUtils';

vi.mock('@features/prompt-optimizer/GenerationsPanel/api', () => ({
  compileWanPrompt: vi.fn(),
  generateStoryboardPreview: vi.fn(),
  generateVideoPreview: vi.fn(),
  waitForVideoJob: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/utils/generationUtils', () => ({
  buildGeneration: vi.fn(),
  resolveGenerationOptions: vi.fn(),
}));

const mockCompileWanPrompt = vi.mocked(compileWanPrompt);
const mockGenerateStoryboardPreview = vi.mocked(generateStoryboardPreview);
const mockGenerateVideoPreview = vi.mocked(generateVideoPreview);
const mockWaitForVideoJob = vi.mocked(waitForVideoJob);
const mockBuildGeneration = vi.mocked(buildGeneration);
const mockResolveGenerationOptions = vi.mocked(resolveGenerationOptions);

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-1',
  tier: 'draft',
  status: 'pending',
  model: 'wan-2.2',
  prompt: 'Prompt',
  promptVersionId: 'version-1',
  createdAt: 1,
  completedAt: null,
  mediaType: 'video',
  mediaUrls: [],
  thumbnailUrl: null,
  error: null,
  ...overrides,
});

describe('useGenerationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let counter = 0;
    mockBuildGeneration.mockImplementation((tier, model, prompt, params) => {
      counter += 1;
      return createGeneration({
        id: `gen-${counter}`,
        tier,
        model,
        prompt,
        promptVersionId: params.promptVersionId ?? null,
        status: 'pending',
      });
    });
    mockResolveGenerationOptions.mockReturnValue({
      aspectRatio: '16:9',
      promptVersionId: 'version-1',
      duration: 5,
      fps: 24,
      generationParams: { seed: 1 },
      startImage: null,
    });
    mockCompileWanPrompt.mockResolvedValue('compiled');
  });

  describe('error handling', () => {
    it('marks draft generation as failed when storyboard response is invalid', async () => {
      const dispatch = vi.fn();
      mockGenerateStoryboardPreview.mockResolvedValue({ success: false, error: 'No frames' });

      const { result } = renderHook(() =>
        useGenerationActions(dispatch, { promptVersionId: 'version-1' })
      );

      await act(async () => {
        await result.current.generateDraft('flux-kontext', 'Prompt', { promptVersionId: 'version-1' });
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'UPDATE_GENERATION', payload: expect.objectContaining({ id: 'gen-1', updates: expect.objectContaining({ status: 'failed', error: 'No frames' }) }) })
      );
    });

    it('marks render generation as failed when preview generation fails', async () => {
      const dispatch = vi.fn();
      mockGenerateVideoPreview.mockResolvedValue({ success: false, error: 'No credits' });

      const { result } = renderHook(() =>
        useGenerationActions(dispatch, { promptVersionId: 'version-1' })
      );

      await act(async () => {
        await result.current.generateRender('sora-2', 'Prompt', { promptVersionId: 'version-1' });
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_GENERATION',
          payload: expect.objectContaining({
            id: 'gen-1',
            updates: expect.objectContaining({ status: 'failed', error: 'No credits' }),
          }),
        })
      );
    });

    it('marks render generation as failed when the job never returns a video', async () => {
      const dispatch = vi.fn();
      mockGenerateVideoPreview.mockResolvedValue({ success: true, jobId: 'job-1' });
      mockWaitForVideoJob.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useGenerationActions(dispatch, { promptVersionId: 'version-1' })
      );

      await act(async () => {
        await result.current.generateRender('sora-2', 'Prompt', { promptVersionId: 'version-1' });
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_GENERATION',
          payload: expect.objectContaining({
            id: 'gen-1',
            updates: expect.objectContaining({ status: 'failed', error: 'Failed to render video' }),
          }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('does nothing when retrying a missing generation id', () => {
      const dispatch = vi.fn();
      const { result } = renderHook(() =>
        useGenerationActions(dispatch, { generations: [], promptVersionId: 'version-1' })
      );

      act(() => {
        result.current.retryGeneration('missing');
      });

      expect(dispatch).not.toHaveBeenCalled();
      expect(mockGenerateVideoPreview).not.toHaveBeenCalled();
    });

    it('uses character asset id when start image comes from an asset', async () => {
      const dispatch = vi.fn();
      mockResolveGenerationOptions.mockReturnValue({
        aspectRatio: '16:9',
        promptVersionId: 'version-1',
        duration: 5,
        fps: 24,
        generationParams: { seed: 2 },
        startImage: { url: 'https://cdn/start.png', source: 'asset', assetId: 'asset-1' },
      });
      mockGenerateVideoPreview.mockResolvedValue({ success: true, videoUrl: 'https://cdn/video.mp4' });

      const { result } = renderHook(() =>
        useGenerationActions(dispatch, { promptVersionId: 'version-1' })
      );

      await act(async () => {
        await result.current.generateRender('sora-2', 'Prompt', { promptVersionId: 'version-1' });
      });

      expect(mockGenerateVideoPreview).toHaveBeenCalledWith(
        'Prompt',
        '16:9',
        'sora-2',
        expect.objectContaining({
          characterAssetId: 'asset-1',
          generationParams: { seed: 2 },
        })
      );
    });
  });

  describe('core behavior', () => {
    it('finalizes storyboard generations with media urls', async () => {
      const dispatch = vi.fn();
      mockGenerateStoryboardPreview.mockResolvedValue({
        success: true,
        data: {
          imageUrls: ['https://cdn/frame1.png', 'https://cdn/frame2.png'],
          storagePaths: ['users/path1', 'users/path2'],
          baseImageUrl: 'https://cdn/base.png',
          deltas: [],
        },
      });

      const { result } = renderHook(() =>
        useGenerationActions(dispatch, { promptVersionId: 'version-1' })
      );

      await act(async () => {
        await result.current.generateStoryboard('Storyboard prompt', { promptVersionId: 'version-1' });
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_GENERATION',
          payload: expect.objectContaining({
            id: 'gen-1',
            updates: expect.objectContaining({
              status: 'completed',
              mediaUrls: ['https://cdn/frame1.png', 'https://cdn/frame2.png'],
              thumbnailUrl: 'https://cdn/base.png',
              mediaAssetIds: ['users/path1', 'users/path2'],
            }),
          }),
        })
      );
    });
  });
});
