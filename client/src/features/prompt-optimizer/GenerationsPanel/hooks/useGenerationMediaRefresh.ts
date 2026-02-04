import { useEffect, useRef } from 'react';
import { storageApi } from '@/api/storageApi';
import {
  getImageAssetViewUrl,
  getVideoAssetViewUrl,
} from '@/features/preview/api/previewApi';
import {
  extractStorageObjectPath,
  extractVideoContentAssetId,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from '@/utils/storageUrl';
import { logger } from '@/services/LoggingService';
import type { Generation } from '../types';
import type { GenerationsAction } from './useGenerationsState';

const log = logger.child('MediaRefresh');
const SIGNED_URL_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const VIEW_URL_MIN_INTERVAL_MS = 250;
const VIEW_URL_MAX_CONCURRENCY = 2;

type AssetKind = 'image' | 'video';

// Bug 16 fix: use JSON to avoid delimiter collision with URLs containing '|'
const buildSignature = (generation: Generation): string =>
  JSON.stringify([generation.mediaUrls, generation.thumbnailUrl ?? '']);

let nextViewUrlAt = 0;
let activeViewUrlCount = 0;
const viewUrlQueue: Array<() => void> = [];

const scheduleViewUrlRequest = async <T,>(task: () => Promise<T>): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const run = async () => {
      activeViewUrlCount += 1;
      try {
        const waitMs = Math.max(0, nextViewUrlAt - Date.now());
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
        nextViewUrlAt = Date.now() + VIEW_URL_MIN_INTERVAL_MS;
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeViewUrlCount -= 1;
        const next = viewUrlQueue.shift();
        if (next) {
          next();
        }
      }
    };

    if (activeViewUrlCount < VIEW_URL_MAX_CONCURRENCY) {
      void run();
      return;
    }

    viewUrlQueue.push(() => void run());
  });

const getAssetIdFromPath = (path: string): string | null => {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
};

const resolveViaStoragePath = async (path: string): Promise<string | null> => {
  try {
    const { viewUrl } = (await scheduleViewUrlRequest(
      async () => (await storageApi.getViewUrl(path)) as { viewUrl: string }
    )) as { viewUrl: string };
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
    const response = await scheduleViewUrlRequest(async () =>
      kind === 'video' ? await getVideoAssetViewUrl(assetId) : await getImageAssetViewUrl(assetId)
    );
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

const shouldRefreshUrl = (rawUrl: string | null | undefined, storagePath?: string): boolean => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return Boolean(storagePath);
  }

  // Force refresh for legacy V2 signed URLs (GoogleAccessId/Signature/Expires)
  if (hasGcsSignedUrlParams(rawUrl)) {
    const url = rawUrl.trim();
    const hasV4 =
      url.includes('X-Goog-Algorithm=') ||
      url.includes('X-Goog-Credential=') ||
      url.includes('X-Goog-Signature=');
    const hasV2 = url.includes('GoogleAccessId=') || url.includes('Signature=');
    if (hasV2 && !hasV4) {
      return true;
    }
  }

  if (storagePath) {
    const hasKnownStorageUrl =
      Boolean(extractStorageObjectPath(rawUrl)) || Boolean(extractVideoContentAssetId(rawUrl));
    if (!hasKnownStorageUrl) {
      return true;
    }
  }

  if (!hasGcsSignedUrlParams(rawUrl)) {
    return false;
  }
  const expiresAtMs = parseGcsSignedUrlExpiryMs(rawUrl);
  if (!expiresAtMs) {
    return false;
  }
  return Date.now() >= expiresAtMs - SIGNED_URL_REFRESH_BUFFER_MS;
};

const hasRefreshableMedia = (generation: Generation): boolean => {
  const assetIds = generation.mediaAssetIds;
  if (
    generation.mediaUrls.some((url, index) =>
      shouldRefreshUrl(url, assetIds?.[index] || undefined)
    )
  ) {
    return true;
  }
  if (generation.thumbnailUrl && shouldRefreshUrl(generation.thumbnailUrl)) {
    return true;
  }
  return false;
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
  const mediaRefreshFlags = generation.mediaUrls.map((url, index) =>
    shouldRefreshUrl(url, assetIds?.[index] || undefined)
  );
  const shouldRefreshThumb = shouldRefreshUrl(generation.thumbnailUrl ?? null);

  if (!mediaRefreshFlags.some(Boolean) && !shouldRefreshThumb) {
    return null;
  }

  const resolvedMediaUrls = hasMedia
    ? await Promise.all(
        generation.mediaUrls.map((url, index) =>
          mediaRefreshFlags[index]
            ? resolveMediaUrl(url, mediaKind, assetIds?.[index] || undefined)
            : url
        )
      )
    : generation.mediaUrls;

  const resolvedThumbnail = generation.thumbnailUrl
    ? shouldRefreshThumb
      ? await resolveMediaUrl(generation.thumbnailUrl, 'image')
      : generation.thumbnailUrl
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
      const alreadyProcessed = processedRef.current.get(generation.id) === signature;
      const needsRefresh = hasRefreshableMedia(generation);
      if (alreadyProcessed && !needsRefresh) return;
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
