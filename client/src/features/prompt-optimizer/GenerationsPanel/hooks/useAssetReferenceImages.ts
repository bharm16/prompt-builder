import { useCallback, useEffect, useState } from 'react';
import { assetApi } from '@/features/assets/api/assetApi';

interface ReferenceImage {
  assetId: string;
  assetType: string;
  assetName?: string;
  imageUrl: string;
}

interface UseAssetReferenceImagesReturn {
  referenceImages: ReferenceImage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAssetReferenceImages(
  prompt: string
): UseAssetReferenceImagesReturn {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReferenceImages = useCallback(async () => {
    if (!prompt || !/@[a-zA-Z]/.test(prompt)) {
      setReferenceImages([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await assetApi.resolve(prompt);
      setReferenceImages(result.referenceImages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve assets');
      setReferenceImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  useEffect(() => {
    const debounceTimer = setTimeout(fetchReferenceImages, 500);
    return () => clearTimeout(debounceTimer);
  }, [fetchReferenceImages]);

  return {
    referenceImages,
    isLoading,
    error,
    refresh: fetchReferenceImages,
  };
}
