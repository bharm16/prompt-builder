import { useEffect, useRef } from 'react';
import { resolveMediaUrl, type MediaUrlRequest } from '@/services/media/MediaUrlResolver';
import { extractStorageObjectPath } from '@/utils/storageUrl';
import { logger } from '@/services/LoggingService';
import type { Generation } from '../types';
import type { GenerationsAction } from './useGenerationsState';

const log = logger.child('MediaRefresh');
const buildSignature = (generation: Generation): string =>
  JSON.stringify([generation.mediaUrls, generation.thumbnailUrl ?? '']);

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
    storagePath
      ? null
      : normalizedRef
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

  const resolvedMediaUrls = hasMedia
    ? await Promise.all(
        generation.mediaUrls.map(async (url, index) => {
          const { storagePath, assetId } = resolveAssetHints(url, assetRefs?.[index] || null);
          const request: MediaUrlRequest = {
            kind: mediaKind,
            url,
            preferFresh: true,
            ...(storagePath !== null ? { storagePath } : { storagePath: null }),
            ...(assetId !== null ? { assetId } : { assetId: null }),
          };
          const result = await resolveMediaUrl(request);
          return result.url ?? url;
        })
      )
    : generation.mediaUrls;

  const resolvedThumbnail = generation.thumbnailUrl
    ? (
        await resolveMediaUrl({
          kind: 'image',
          url: generation.thumbnailUrl,
          storagePath: extractStorageObjectPath(generation.thumbnailUrl) ?? null,
          preferFresh: true,
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
      if (alreadyProcessed) return;
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
