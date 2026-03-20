import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Generation } from '@features/generations/types';
import { useGenerationMediaRefresh } from '@features/generations/hooks/useGenerationMediaRefresh';
import { resolveMediaUrl, resolveImageAssetBatch } from '@/services/media/MediaUrlResolver';

vi.mock('@/services/media/MediaUrlResolver', () => ({
  resolveMediaUrl: vi.fn(),
  resolveImageAssetBatch: vi.fn().mockResolvedValue(new Map()),
  isMediaCircuitOpen: vi.fn().mockReturnValue(false),
}));

const mockResolveMediaUrl = vi.mocked(resolveMediaUrl);
const mockResolveImageAssetBatch = vi.mocked(resolveImageAssetBatch);

const buildGeneration = (id: string): Generation => ({
  id,
  tier: 'draft',
  status: 'completed',
  model: 'flux',
  prompt: 'test prompt',
  promptVersionId: 'version-1',
  createdAt: Date.now(),
  completedAt: Date.now(),
  mediaType: 'image',
  mediaUrls: [`/api/preview/image/view?assetId=${id}`],
  mediaAssetIds: [id],
  thumbnailUrl: null,
});

describe('regression: batch 429 aborts individual resolution to prevent retry storm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('when batch pre-resolution returns 429, no individual resolveMediaUrl calls are made in that cycle', async () => {
    const rateLimitedError = Object.assign(new Error('Too many requests'), { status: 429 });
    mockResolveImageAssetBatch.mockRejectedValueOnce(rateLimitedError);

    const dispatch = vi.fn();
    const generations = [buildGeneration('asset-a'), buildGeneration('asset-b')];

    renderHook(() => useGenerationMediaRefresh(generations, dispatch));

    // Let the effect and async work settle
    await act(async () => {
      await Promise.resolve();
    });

    // Batch was called and 429'd
    expect(mockResolveImageAssetBatch).toHaveBeenCalledTimes(1);

    // Individual resolution must NOT have been called — the batch 429 should
    // have aborted Phase 2 entirely to avoid a cascade of individual 429s.
    expect(mockResolveMediaUrl).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();

    // After the retry cooldown, the hook should re-attempt
    mockResolveImageAssetBatch.mockResolvedValueOnce(new Map([
      ['asset-a', 'https://storage.example.com/asset-a'],
      ['asset-b', 'https://storage.example.com/asset-b'],
    ]));
    mockResolveMediaUrl.mockResolvedValue({
      url: 'https://storage.example.com/resolved',
      source: 'preview',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Now the batch should succeed and individual resolution should proceed
    expect(mockResolveImageAssetBatch).toHaveBeenCalledTimes(2);
  });
});
