import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssets } from '../hooks/useAssets';
import { assetApi } from '../api/assetApi';
import type { Asset } from '@shared/types/asset';

vi.mock('../api/assetApi', () => ({
  assetApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useAssets', () => {
  describe('error handling', () => {
    it('sets error and rethrows when list fails', async () => {
      vi.mocked(assetApi.list).mockRejectedValueOnce(new Error('Network')); 

      const { result } = renderHook(() => useAssets());

      await act(async () => {
        await expect(result.current.listAssets()).rejects.toThrow('Network');
      });

      expect(result.current.error).toBe('Network');
      expect(result.current.isLoading).toBe(false);
    });

    it('uses Unknown error when rejection is not an Error', async () => {
      vi.mocked(assetApi.list).mockRejectedValueOnce('boom');

      const { result } = renderHook(() => useAssets());

      await act(async () => {
        await expect(result.current.listAssets()).rejects.toThrow();
      });

      expect(result.current.error).toBe('Unknown error');
    });
  });

  describe('edge cases', () => {
    it('clears previous error on successful request', async () => {
      vi.mocked(assetApi.list)
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ assets: [], total: 0, byType: { character: 0, style: 0, location: 0, object: 0 } });

      const { result } = renderHook(() => useAssets());

      await act(async () => {
        await expect(result.current.listAssets()).rejects.toThrow('Fail');
      });

      await act(async () => {
        await result.current.listAssets();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns created asset from createAsset', async () => {
      const asset: Asset = {
        id: 'a1',
        userId: 'u1',
        type: 'character',
        trigger: '@Ada',
        name: 'Ada',
        textDefinition: 'Text',
        referenceImages: [],
        usageCount: 0,
        lastUsedAt: null,
        createdAt: 'now',
        updatedAt: 'now',
      };

      vi.mocked(assetApi.create).mockResolvedValueOnce(asset);

      const { result } = renderHook(() => useAssets());

      let created: Asset | undefined;
      await act(async () => {
        created = await result.current.createAsset({
          type: 'character',
          trigger: '@Ada',
          name: 'Ada',
        });
      });

      expect(created).toEqual(asset);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
