import { useCallback, useEffect, useState } from 'react';
import { referenceImageApi, type ReferenceImage } from '../api/referenceImageApi';

interface UseReferenceImagesState {
  images: ReferenceImage[];
  isLoading: boolean;
  error: string | null;
}

interface UseReferenceImagesActions {
  refresh: () => Promise<void>;
  uploadImage: (file: File, options?: { label?: string; source?: string }) => Promise<ReferenceImage>;
  uploadFromUrl: (sourceUrl: string, options?: { label?: string; source?: string }) => Promise<ReferenceImage>;
  deleteImage: (imageId: string) => Promise<void>;
}

export function useReferenceImages(): UseReferenceImagesState & UseReferenceImagesActions {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await referenceImageApi.list();
      setImages(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reference images');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadImage = useCallback(
    async (file: File, options: { label?: string; source?: string } = {}) => {
      const created = await referenceImageApi.upload(file, options);
      setImages((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const uploadFromUrl = useCallback(
    async (sourceUrl: string, options: { label?: string; source?: string } = {}) => {
      const created = await referenceImageApi.uploadFromUrl(sourceUrl, options);
      setImages((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const deleteImage = useCallback(async (imageId: string) => {
    await referenceImageApi.delete(imageId);
    setImages((prev) => prev.filter((image) => image.id !== imageId));
  }, []);

  return {
    images,
    isLoading,
    error,
    refresh,
    uploadImage,
    uploadFromUrl,
    deleteImage,
  };
}

export default useReferenceImages;
