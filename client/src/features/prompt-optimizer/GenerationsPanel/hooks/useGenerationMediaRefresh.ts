import { useEffect, useRef } from 'react';
import { storageApi } from '@/api/storageApi';
import {
  getImageAssetViewUrl,
  getVideoAssetViewUrl,
} from '@/features/preview/api/previewApi';
import {
  extractStorageObjectPath,
  extractVideoContentAssetId,
} from '@/utils/storageUrl';
import type { Generation } from '../types';
import type { GenerationsAction } from './useGenerationsState';

type AssetKind = 'image' | 'video';

const buildSignature = (generation: Generation): string =>
  `${generation.mediaUrls.join('|')}|${generation.thumbnailUrl ?? ''}`;

const getAssetIdFromPath = (path: string): string | null => {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
};

const resolveViaStoragePath = async (path: string): Promise<string | null> => {
  try {
    const { viewUrl } = (await storageApi.getViewUrl(path)) as { viewUrl: string };
    return viewUrl || null;
  } catch {
    return null;
  }
};

const resolveViaAssetId = async (
  assetId: string,
  kind: AssetKind
): Promise<string | null> => {
  try {
    const response =
      kind === 'video'
        ? await getVideoAssetViewUrl(assetId)
        : await getImageAssetViewUrl(assetId);
    return response.success ? response.data?.viewUrl ?? null : null;
  } catch {
    return null;
  }
};

const resolveMediaUrl = async (
  rawUrl: string,
  kind: AssetKind
): Promise<string> => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  const objectPath = extractStorageObjectPath(rawUrl);
  if (objectPath) {
    if (objectPath.startsWith('users/')) {
      const refreshed = await resolveViaStoragePath(objectPath);
      return refreshed || rawUrl;
    }

    const assetId = getAssetIdFromPath(objectPath);
    if (assetId) {
      const refreshed = await resolveViaAssetId(assetId, kind);
      return refreshed || rawUrl;
    }
  }

  if (kind === 'video') {
    const assetId = extractVideoContentAssetId(rawUrl);
    if (assetId) {
      const refreshed = await resolveViaAssetId(assetId, 'video');
      return refreshed || rawUrl;
    }
  }

  return rawUrl;
};

const resolveGenerationMedia = async (
  generation: Generation
): Promise<{ updates: Partial<Generation>; signature: string } | null> => {
  const hasMedia = generation.mediaUrls.length > 0;
  const hasThumb = Boolean(generation.thumbnailUrl);

  if (!hasMedia && !hasThumb) {
    return null;
  }

  const mediaKind: AssetKind = generation.mediaType === 'video' ? 'video' : 'image';
  const resolvedMediaUrls = hasMedia
    ? await Promise.all(
        generation.mediaUrls.map((url) => resolveMediaUrl(url, mediaKind))
      )
    : generation.mediaUrls;

  const resolvedThumbnail = generation.thumbnailUrl
    ? await resolveMediaUrl(generation.thumbnailUrl, 'image')
    : generation.thumbnailUrl;

  const mediaChanged = resolvedMediaUrls.some(
    (url, index) => url !== generation.mediaUrls[index]
  );
  const thumbChanged = resolvedThumbnail !== generation.thumbnailUrl;

  if (!mediaChanged && !thumbChanged) {
    return null;
  }

  const updates: Partial<Generation> = {};
  if (mediaChanged) {
    updates.mediaUrls = resolvedMediaUrls;
  }
  if (thumbChanged) {
    updates.thumbnailUrl = resolvedThumbnail ?? null;
  }

  const signature = `${(updates.mediaUrls ?? generation.mediaUrls).join('|')}|${
    updates.thumbnailUrl ?? generation.thumbnailUrl ?? ''
  }`;

  return { updates, signature };
};

export function useGenerationMediaRefresh(
  generations: Generation[],
  dispatch: React.Dispatch<GenerationsAction>
): void {
  const inFlightRef = useRef<Set<string>>(new Set());
  const processedRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let isActive = true;

    generations.forEach((generation) => {
      if (generation.status !== 'completed') return;
      if (!generation.mediaUrls.length && !generation.thumbnailUrl) return;

      const signature = buildSignature(generation);
      if (processedRef.current.get(generation.id) === signature) return;
      if (inFlightRef.current.has(generation.id)) return;

      inFlightRef.current.add(generation.id);

      void resolveGenerationMedia(generation)
        .then((result) => {
          if (!isActive) return;
          if (result) {
            dispatch({
              type: 'UPDATE_GENERATION',
              payload: { id: generation.id, updates: result.updates },
            });
            processedRef.current.set(generation.id, result.signature);
            return;
          }
          processedRef.current.set(generation.id, signature);
        })
        .finally(() => {
          inFlightRef.current.delete(generation.id);
        });
    });

    return () => {
      isActive = false;
    };
  }, [dispatch, generations]);
}

