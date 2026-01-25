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
import { logger } from '@/services/LoggingService';
import type { Generation } from '../types';
import type { GenerationsAction } from './useGenerationsState';

const log = logger.child('MediaRefresh');

type AssetKind = 'image' | 'video';

// Bug 16 fix: use JSON to avoid delimiter collision with URLs containing '|'
const buildSignature = (generation: Generation): string =>
  JSON.stringify([generation.mediaUrls, generation.thumbnailUrl ?? '']);

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
    if (!response.success) {
      log.warn('Asset view URL request failed', { assetId, kind, error: response.error });
      return null;
    }
    return response.data?.viewUrl ?? null;
  } catch (error) {
    log.warn('Failed to resolve asset view URL', {
      assetId,
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const resolveMediaUrl = async (
  rawUrl: string,
  kind: AssetKind,
  storagePath?: string
): Promise<string> => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  // Prefer explicit storage path when available (reliable refresh)
  if (storagePath) {
    if (storagePath.startsWith('users/')) {
      const refreshed = await resolveViaStoragePath(storagePath);
      if (refreshed) return refreshed;
    }

    const assetId = getAssetIdFromPath(storagePath);
    if (assetId) {
      const refreshed = await resolveViaAssetId(assetId, kind);
      if (refreshed) return refreshed;
    }
  }

  // Fall back to parsing storage path from URL (legacy generations)
  const objectPath = extractStorageObjectPath(rawUrl);
  if (objectPath) {
    if (objectPath.startsWith('users/')) {
      const refreshed = await resolveViaStoragePath(objectPath);
      return refreshed || rawUrl;
    }

    const assetId = getAssetIdFromPath(objectPath);
    if (assetId) {
      const refreshed = await resolveViaAssetId(assetId, kind);
      if (!refreshed) {
        log.warn('Failed to refresh URL, using original', { assetId, kind, objectPath });
      }
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
  const assetIds = generation.mediaAssetIds;
  const resolvedMediaUrls = hasMedia
    ? await Promise.all(
        generation.mediaUrls.map((url, index) =>
          resolveMediaUrl(url, mediaKind, assetIds?.[index] || undefined)
        )
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

  // Bug 16 fix: use JSON for consistent signature format
  const signature = JSON.stringify([
    updates.mediaUrls ?? generation.mediaUrls,
    updates.thumbnailUrl ?? generation.thumbnailUrl ?? '',
  ]);

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

    // Bug 10 fix: prune processedRef entries for generations that were removed
    const currentIds = new Set(generations.map((g) => g.id));
    for (const id of processedRef.current.keys()) {
      if (!currentIds.has(id)) {
        processedRef.current.delete(id);
      }
    }

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
            log.debug('Refreshed generation media', {
              id: generation.id,
              mediaUrlsChanged: result.updates.mediaUrls !== undefined,
              thumbnailChanged: result.updates.thumbnailUrl !== undefined,
            });
            dispatch({
              type: 'UPDATE_GENERATION',
              payload: { id: generation.id, updates: result.updates },
            });
            processedRef.current.set(generation.id, result.signature);
            return;
          }
          processedRef.current.set(generation.id, signature);
        })
        .catch((error) => {
          log.error('Error refreshing generation media', error instanceof Error ? error : undefined, {
            id: generation.id,
          });
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

