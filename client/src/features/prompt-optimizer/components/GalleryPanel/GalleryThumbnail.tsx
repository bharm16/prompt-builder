import React, { useMemo, useState } from 'react';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { extractStorageObjectPath, extractVideoContentAssetId } from '@/utils/storageUrl';
import type { GalleryGeneration } from './types';

interface GalleryThumbnailProps {
  generation: GalleryGeneration;
  isActive: boolean;
  onClick: () => void;
}

export function GalleryThumbnail({
  generation,
  isActive,
  onClick,
}: GalleryThumbnailProps): React.ReactElement {
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const rawThumbnailUrl = useMemo(() => {
    if (typeof generation.thumbnailUrl !== 'string') return null;
    const trimmed = generation.thumbnailUrl.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [generation.thumbnailUrl]);
  const rawMediaUrl = useMemo(() => {
    if (typeof generation.mediaUrl !== 'string') return null;
    const trimmed = generation.mediaUrl.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [generation.mediaUrl]);

  const thumbnailStoragePath = useMemo(
    () => (rawThumbnailUrl ? extractStorageObjectPath(rawThumbnailUrl) : null),
    [rawThumbnailUrl]
  );
  const { url: resolvedThumbnailUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: rawThumbnailUrl,
    storagePath: thumbnailStoragePath,
    deferUntilResolved: true,
    enabled: Boolean(rawThumbnailUrl),
  });

  const videoStoragePath = useMemo(
    () => (rawMediaUrl ? extractStorageObjectPath(rawMediaUrl) : null),
    [rawMediaUrl]
  );
  const videoAssetId = useMemo(
    () => (rawMediaUrl && !videoStoragePath ? extractVideoContentAssetId(rawMediaUrl) : null),
    [rawMediaUrl, videoStoragePath]
  );
  const { url: resolvedVideoUrl } = useResolvedMediaUrl({
    kind: 'video',
    url: rawMediaUrl,
    storagePath: videoStoragePath,
    assetId: videoAssetId,
    deferUntilResolved: true,
    enabled: generation.mediaType === 'video' && Boolean(rawMediaUrl || videoStoragePath || videoAssetId),
  });

  const showVideoFallback =
    generation.mediaType === 'video' &&
    !resolvedThumbnailUrl &&
    Boolean(resolvedVideoUrl) &&
    !videoLoadFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-[105px] w-full flex-shrink-0 overflow-hidden rounded-[10px] border-2 transition-opacity ${
        isActive
          ? 'border-[#3A3D46] opacity-100'
          : 'border-transparent opacity-75 hover:border-[#3A3D46] hover:opacity-100'
      }`}
      aria-label="Open generation details"
      data-testid={`gallery-thumbnail-${generation.id}`}
    >
      {resolvedThumbnailUrl ? (
        <img
          src={resolvedThumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : showVideoFallback ? (
        <video
          src={resolvedVideoUrl ?? undefined}
          className="h-full w-full object-cover"
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          onError={() => setVideoLoadFailed(true)}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#1A1C22] to-[#0D0E12]" />
      )}
    </button>
  );
}
