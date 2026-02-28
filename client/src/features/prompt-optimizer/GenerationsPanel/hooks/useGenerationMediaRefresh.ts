import { useEffect, useRef, useState } from 'react';
import { resolveMediaUrl, type MediaUrlRequest } from '@/services/media/MediaUrlResolver';
import { extractStorageObjectPath } from '@/utils/storageUrl';
import { logger } from '@/services/LoggingService';
import type { Generation } from '../types';
import type { GenerationsAction } from './useGenerationsState';

const log = logger.child('MediaRefresh');
const MEDIA_REFRESH_RETRY_COOLDOWN_MS = 15_000;

const buildSignature = (generation: Generation): string =>
  JSON.stringify([generation.mediaUrls, generation.thumbnailUrl ?? '']);

const getErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
};

const isRetryableError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  if (status === 429) return true;
  if (status !== null && status >= 500 && status <= 599) return true;
  return false;
};

const resolveAssetHints = (
  url: string | null | undefined,
  ref: string | null | undefined
): { storagePath: string | null; assetId: string | null } => {
  const normalizedRef = typeof ref === 'string' ? ref.trim() : '';
  const storagePath =
    normalizedRef && normalizedRef.startsWith('users/')
      ? normalizedRef
      : (url ? extractStorageObjectPath(url) : null);
  const assetId =
    normalizedRef && !normalizedRef.startsWith('users/')
      ? normalizedRef
      : null;
  return { storagePath, assetId };
};

const resolveGenerationMedia = async (
  generation: Generation
): Promise<{ updates: Partial<Generation>; signature: string } | null> => {
  const hasMedia = generation.mediaUrls.length > 0;
  const hasThumb = Boolean(generation.thumbnailUrl);

  if (!hasMedia && !hasThumb) {
    return null;
  }

  const mediaKind = generation.mediaType === 'video' ? 'video' : 'image';
  const assetRefs = generation.mediaAssetIds;

  const resolvedMediaUrls = [...generation.mediaUrls];

  if (hasMedia) {
    for (let index = 0; index < generation.mediaUrls.length; index += 1) {
      const url = generation.mediaUrls[index] ?? '';
      const { storagePath, assetId } = resolveAssetHints(url, assetRefs?.[index] || null);
      const request: MediaUrlRequest = {
        kind: mediaKind,
        url,
        preferFresh: false,
        ...(storagePath !== null ? { storagePath } : { storagePath: null }),
        ...(assetId !== null ? { assetId } : { assetId: null }),
      };
      const result = await resolveMediaUrl(request);
      resolvedMediaUrls[index] = result.url ?? url;
    }
  }

  const resolvedThumbnail = generation.thumbnailUrl
    ? (
        await resolveMediaUrl({
          kind: 'image',
          url: generation.thumbnailUrl,
          storagePath: extractStorageObjectPath(generation.thumbnailUrl) ?? null,
          preferFresh: false,
        })
      ).url ?? generation.thumbnailUrl
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
  const retryAfterRef = useRef<Map<string, number>>(new Map());
  const retryTimersRef = useRef<Map<string, number>>(new Map());
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const retryTimers = retryTimersRef.current;
    const retryAfter = retryAfterRef.current;

    return () => {
      for (const timeoutId of retryTimers.values()) {
        window.clearTimeout(timeoutId);
      }
      retryTimers.clear();
      retryAfter.clear();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    // Bug 10 fix: prune processedRef entries for generations that were removed
    const currentIds = new Set(generations.map((g) => g.id));
    for (const id of processedRef.current.keys()) {
      if (!currentIds.has(id)) {
        processedRef.current.delete(id);
      }
    }
    for (const id of retryAfterRef.current.keys()) {
      if (currentIds.has(id)) continue;
      retryAfterRef.current.delete(id);
      const timeoutId = retryTimersRef.current.get(id);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      retryTimersRef.current.delete(id);
    }

    const runRefresh = async (): Promise<void> => {
      for (const generation of generations) {
        if (!isActive) return;
        if (generation.status !== 'completed') continue;
        if (!generation.mediaUrls.length && !generation.thumbnailUrl) continue;

        const signature = buildSignature(generation);
        const alreadyProcessed = processedRef.current.get(generation.id) === signature;
        if (alreadyProcessed) continue;
        if (inFlightRef.current.has(generation.id)) continue;

        const retryAfter = retryAfterRef.current.get(generation.id);
        if (typeof retryAfter === 'number' && Date.now() < retryAfter) continue;

        inFlightRef.current.add(generation.id);

        try {
          const result = await resolveGenerationMedia(generation);
          if (!isActive) return;
          retryAfterRef.current.delete(generation.id);
          const retryTimer = retryTimersRef.current.get(generation.id);
          if (retryTimer !== undefined) {
            window.clearTimeout(retryTimer);
            retryTimersRef.current.delete(generation.id);
          }

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
            continue;
          }

          processedRef.current.set(generation.id, signature);
        } catch (error) {
          const shouldRetry = isRetryableError(error);
          if (shouldRetry) {
            const retryAt = Date.now() + MEDIA_REFRESH_RETRY_COOLDOWN_MS;
            retryAfterRef.current.set(generation.id, retryAt);

            if (!retryTimersRef.current.has(generation.id)) {
              const timeoutId = window.setTimeout(() => {
                retryTimersRef.current.delete(generation.id);
                retryAfterRef.current.delete(generation.id);
                setRetryToken((value) => value + 1);
              }, MEDIA_REFRESH_RETRY_COOLDOWN_MS);
              retryTimersRef.current.set(generation.id, timeoutId);
            }
          } else {
            processedRef.current.set(generation.id, signature);
          }

          log.error('Error refreshing generation media', error instanceof Error ? error : undefined, {
            id: generation.id,
            retryScheduled: shouldRetry,
          });
        } finally {
          inFlightRef.current.delete(generation.id);
        }
      }
    };

    void runRefresh();

    return () => {
      isActive = false;
    };
  }, [dispatch, generations, retryToken]);
}
