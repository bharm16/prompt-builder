import { useCallback, useEffect, useState } from 'react';
import type { Asset } from '@shared/types/asset';
import { assetApi } from '@/features/assets/api/assetApi';

export interface UploadImageItem {
  file: File;
  preview: string;
  isPrimary?: boolean;
}

interface UseQuickCharacterCreateArgs {
  isOpen: boolean;
  prefillTrigger?: string;
}

export function useQuickCharacterCreate({
  isOpen,
  prefillTrigger,
}: UseQuickCharacterCreateArgs) {
  const [trigger, setTrigger] = useState('');
  const [name, setName] = useState('');
  const [images, setImages] = useState<UploadImageItem[]>([]);
  const [textDefinition, setTextDefinition] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      images.forEach((image) => URL.revokeObjectURL(image.preview));
      setImages([]);
      setError(null);
      return;
    }

    setTrigger(prefillTrigger ?? '');
    setName('');
    setTextDefinition('');
    setNegativePrompt('');
    setIsAdvancedOpen(false);
    setError(null);
  }, [isOpen, prefillTrigger]);

  const handleAddImages = useCallback((files: File[]) => {
    if (!files.length) return;

    setImages((prev) => {
      const next = [...prev];
      const shouldSetPrimary = next.every((image) => !image.isPrimary);
      files.forEach((file, index) => {
        next.push({
          file,
          preview: URL.createObjectURL(file),
          isPrimary: shouldSetPrimary && index === 0,
        });
      });
      return next;
    });
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => {
      if (!prev[index]) return prev;
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      if (!next.some((image) => image.isPrimary) && next[0]) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }, []);

  const handleSetPrimary = useCallback((index: number) => {
    setImages((prev) =>
      prev.map((image, idx) => ({
        ...image,
        isPrimary: idx === index,
      }))
    );
  }, []);

  const createCharacter = useCallback(async (): Promise<Asset | null> => {
    if (!trigger.trim() || !name.trim()) {
      setError('Trigger and name are required.');
      return null;
    }
    if (images.length === 0) {
      setError('Add at least one reference photo.');
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      const normalizedTrigger = trigger.trim().startsWith('@')
        ? trigger.trim()
        : `@${trigger.trim()}`;
      const asset = await assetApi.create({
        type: 'character',
        trigger: normalizedTrigger,
        name: name.trim(),
        ...(textDefinition.trim() ? { textDefinition: textDefinition.trim() } : {}),
        ...(negativePrompt.trim() ? { negativePrompt: negativePrompt.trim() } : {}),
      });

      const uploads = [] as Array<{ id: string | undefined; isPrimary?: boolean }>;
      for (const image of images) {
        const result = await assetApi.addImage(asset.id, image.file);
        uploads.push({ id: result?.image?.id, isPrimary: image.isPrimary });
      }

      const primaryUpload = uploads.find((item) => item.isPrimary) ?? uploads[0];
      if (primaryUpload?.id) {
        await assetApi.setPrimaryImage(asset.id, primaryUpload.id);
      }

      return asset;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create character.';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [images, name, negativePrompt, textDefinition, trigger]);

  return {
    trigger,
    setTrigger,
    name,
    setName,
    images,
    textDefinition,
    setTextDefinition,
    negativePrompt,
    setNegativePrompt,
    isAdvancedOpen,
    setIsAdvancedOpen,
    isCreating,
    error,
    setError,
    handleAddImages,
    handleRemoveImage,
    handleSetPrimary,
    createCharacter,
  };
}

export default useQuickCharacterCreate;
