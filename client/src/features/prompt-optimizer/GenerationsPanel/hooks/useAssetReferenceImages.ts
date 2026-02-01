import { useCallback, useEffect, useRef, useState } from 'react';
import { assetApi } from '@/features/assets/api/assetApi';
import type { ResolvedPrompt } from '@shared/types/asset';

interface ReferenceImage {
  assetId: string;
  assetType: string;
  assetName?: string;
  imageUrl: string;
}

interface UseAssetReferenceImagesReturn {
  referenceImages: ReferenceImage[];
  resolvedPrompt: ResolvedPrompt | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAssetReferenceImages(
  prompt: string
): UseAssetReferenceImagesReturn {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [resolvedPrompt, setResolvedPrompt] = useState<ResolvedPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchReferenceImages = useCallback(async () => {
    if (!prompt || !/@[a-zA-Z]/.test(prompt)) {
      setReferenceImages([]);
      setResolvedPrompt(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await assetApi.resolve(prompt);
      if (requestIdRef.current !== currentRequestId) return;
      setReferenceImages(result.referenceImages || []);
      setResolvedPrompt(result);
    } catch (err) {
      if (requestIdRef.current !== currentRequestId) return;
      setError(err instanceof Error ? err.message : 'Failed to resolve assets');
      setReferenceImages([]);
      setResolvedPrompt(null);
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false);
      }
    }
  }, [prompt]);

  useEffect(() => {
    const debounceTimer = setTimeout(fetchReferenceImages, 500);
    return () => {
      clearTimeout(debounceTimer);
      requestIdRef.current++;
    };
  }, [fetchReferenceImages]);

  return {
    referenceImages,
    resolvedPrompt,
    isLoading,
    error,
    refresh: fetchReferenceImages,
  };
}
