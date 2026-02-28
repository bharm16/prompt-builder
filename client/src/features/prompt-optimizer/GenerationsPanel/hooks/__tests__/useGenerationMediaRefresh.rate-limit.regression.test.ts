import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { useGenerationMediaRefresh } from '@/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationMediaRefresh';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';

vi.mock('@/services/media/MediaUrlResolver', () => ({
  resolveMediaUrl: vi.fn(),
}));

const mockResolveMediaUrl = vi.mocked(resolveMediaUrl);

const buildGeneration = (): Generation => ({
  id: 'gen-1',
  tier: 'draft',
  status: 'completed',
  model: 'flux',
  prompt: 'prompt',
  promptVersionId: 'version-1',
  createdAt: Date.now(),
  completedAt: Date.now(),
  mediaType: 'image',
  mediaUrls: ['/api/preview/image/view?assetId=asset-1'],
  mediaAssetIds: ['asset-1'],
  thumbnailUrl: null,
});

describe('regression: generation media refresh retries after transient 429 errors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('backs off on 429 and retries after cooldown instead of marking media as processed', async () => {
    const rateLimitedError = Object.assign(new Error('Too many requests'), { status: 429 });

    mockResolveMediaUrl
      .mockRejectedValueOnce(rateLimitedError)
      .mockResolvedValueOnce({
        url: 'https://storage.example.com/image-previews/asset-1',
        source: 'preview',
      });

    const dispatch = vi.fn();
    const generations = [buildGeneration()];

    renderHook(() => useGenerationMediaRefresh(generations, dispatch));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockResolveMediaUrl).toHaveBeenCalledTimes(1);

    expect(mockResolveMediaUrl).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ preferFresh: false })
    );
    expect(dispatch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockResolveMediaUrl).toHaveBeenCalledTimes(2);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_GENERATION',
      payload: {
        id: 'gen-1',
        updates: {
          mediaUrls: ['https://storage.example.com/image-previews/asset-1'],
        },
      },
    });
  });
});
