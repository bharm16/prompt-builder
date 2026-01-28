import { useState, useCallback } from 'react';
import type { Asset, AssetListResponse, AssetType } from '@shared/types/asset';
import { assetApi } from '../api/assetApi';

export function useAssets() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listAssets = useCallback(
    async (type: AssetType | null = null): Promise<AssetListResponse> =>
      await withLoading(() => assetApi.list(type)),
    [withLoading]
  );

  const createAsset = useCallback(
    async (payload: {
      type: AssetType;
      trigger: string;
      name: string;
      textDefinition?: string;
      negativePrompt?: string;
    }): Promise<Asset> => await withLoading(() => assetApi.create(payload)),
    [withLoading]
  );

  const updateAsset = useCallback(
    async (
      assetId: string,
      payload: { trigger?: string; name?: string; textDefinition?: string; negativePrompt?: string }
    ): Promise<Asset> => await withLoading(() => assetApi.update(assetId, payload)),
    [withLoading]
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<boolean> => await withLoading(() => assetApi.delete(assetId)),
    [withLoading]
  );

  return {
    isLoading,
    error,
    listAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    setError,
  };
}

export default useAssets;
