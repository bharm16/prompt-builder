import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useAssetReferenceImages } from '@features/prompt-optimizer/GenerationsPanel/hooks/useAssetReferenceImages';
import { assetApi } from '@features/assets/api/assetApi';

vi.mock('@features/assets/api/assetApi', () => ({
  assetApi: {
    resolve: vi.fn(),
  },
}));

const mockResolve = vi.mocked(assetApi.resolve);

type ResolvedPromptPayload = Awaited<ReturnType<typeof assetApi.resolve>>;
type ResolvedAsset = ResolvedPromptPayload['assets'][number];

const createAsset = (overrides: Partial<ResolvedAsset> = {}): ResolvedAsset => ({
  id: overrides.id ?? 'asset-1',
  userId: overrides.userId ?? 'user-1',
  type: overrides.type ?? 'character',
  trigger: overrides.trigger ?? '@hero',
  name: overrides.name ?? 'Hero',
  textDefinition: overrides.textDefinition ?? 'Hero character',
  referenceImages: overrides.referenceImages ?? [],
  usageCount: overrides.usageCount ?? 0,
  lastUsedAt: overrides.lastUsedAt ?? null,
  createdAt: overrides.createdAt ?? '2024-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00Z',
  ...overrides,
}) as ResolvedAsset;

describe('useAssetReferenceImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('exposes an error when resolve fails', async () => {
      mockResolve.mockRejectedValue(new Error('Resolve failed'));

      const { result } = renderHook(() => useAssetReferenceImages('Hello @asset'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.error).toBe('Resolve failed');
      expect(result.current.referenceImages).toEqual([]);
      expect(result.current.resolvedPrompt).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('skips resolution when the prompt contains no asset references', async () => {
      const { result } = renderHook(() => useAssetReferenceImages('Just text'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockResolve).not.toHaveBeenCalled();
      expect(result.current.referenceImages).toEqual([]);
      expect(result.current.resolvedPrompt).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('resolves assets and exposes reference images', async () => {
      mockResolve.mockResolvedValue({
        originalText: 'Use @hero',
        expandedText: 'Use Hero',
        assets: [createAsset({ id: 'asset-1', trigger: '@hero' })],
        referenceImages: [
          {
            assetId: 'asset-1',
            assetType: 'character',
            imageUrl: 'https://cdn/image.png',
          },
        ],
        characters: [createAsset({ id: 'asset-1', trigger: '@hero' })],
        styles: [],
        locations: [],
        objects: [],
        requiresKeyframe: false,
        negativePrompts: [],
      });

      const { result } = renderHook(() => useAssetReferenceImages('Use @hero'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.referenceImages).toHaveLength(1);
      expect(result.current.referenceImages[0]?.assetId).toBe('asset-1');
      expect(result.current.resolvedPrompt?.characters?.[0]?.trigger).toBe('@hero');
      expect(result.current.error).toBeNull();
    });
  });
});
