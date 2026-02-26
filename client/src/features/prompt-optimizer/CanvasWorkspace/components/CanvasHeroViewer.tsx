import React, { useMemo } from 'react';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { extractStorageObjectPath } from '@/utils/storageUrl';
import { formatRelativeTime } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { getModelConfig } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';
import { resolvePrimaryVideoSource } from '@/features/prompt-optimizer/GenerationsPanel/utils/videoSource';

interface CanvasHeroViewerProps {
  generation: Generation | null;
}

const resolveTierLabel = (generation: Generation | null): string => {
  if (!generation) return '—';
  if (generation.mediaType === 'image-sequence') return 'preview';
  if (generation.tier === 'draft') return 'draft';
  return 'final';
};

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveAspectRatio = (generation: Generation | null): string => {
  if (!generation?.aspectRatio) return '16 / 9';
  const [left, right] = generation.aspectRatio.split(':');
  const leftNumber = Number.parseFloat(left ?? '');
  const rightNumber = Number.parseFloat(right ?? '');
  if (
    !Number.isFinite(leftNumber) ||
    !Number.isFinite(rightNumber) ||
    leftNumber <= 0 ||
    rightNumber <= 0
  ) {
    return '16 / 9';
  }
  return `${leftNumber} / ${rightNumber}`;
};

export function CanvasHeroViewer({
  generation,
}: CanvasHeroViewerProps): React.ReactElement {
  const rawPrimaryMediaUrl = useMemo(
    () => normalizeUrl(generation?.mediaUrls[0] ?? null),
    [generation?.mediaUrls]
  );
  const rawThumbnailUrl = useMemo(
    () => normalizeUrl(generation?.thumbnailUrl ?? null),
    [generation?.thumbnailUrl]
  );
  const primaryMediaRef = generation?.mediaAssetIds?.[0] ?? null;
  const { storagePath: videoStoragePath, assetId: videoAssetId } = useMemo(
    () => resolvePrimaryVideoSource(rawPrimaryMediaUrl, primaryMediaRef),
    [primaryMediaRef, rawPrimaryMediaUrl]
  );
  const { url: resolvedVideoUrl } = useResolvedMediaUrl({
    kind: 'video',
    url: rawPrimaryMediaUrl,
    storagePath: videoStoragePath,
    assetId: videoAssetId,
    deferUntilResolved: true,
    enabled: Boolean(
      generation &&
      generation.mediaType === 'video' &&
      (rawPrimaryMediaUrl || videoStoragePath || videoAssetId)
    ),
  });

  const fallbackImageUrl = useMemo(() => {
    if (generation?.mediaType === 'video') {
      return rawThumbnailUrl;
    }
    return rawThumbnailUrl ?? rawPrimaryMediaUrl;
  }, [generation?.mediaType, rawPrimaryMediaUrl, rawThumbnailUrl]);
  const fallbackImageStoragePath = useMemo(
    () => (fallbackImageUrl ? extractStorageObjectPath(fallbackImageUrl) : null),
    [fallbackImageUrl]
  );
  const { url: resolvedImageUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: fallbackImageUrl,
    storagePath: fallbackImageStoragePath,
    deferUntilResolved: true,
    enabled: Boolean(fallbackImageUrl),
  });

  const metadata = useMemo(() => {
    if (!generation) return 'No generations yet';

    const parts = [
      resolveTierLabel(generation),
      generation.duration ? `${generation.duration}s` : null,
      getModelConfig(generation.model)?.label ?? generation.model,
      formatRelativeTime(generation.completedAt ?? generation.createdAt),
    ].filter(Boolean);
    return parts.join(' · ');
  }, [generation]);

  const aspectRatio = useMemo(() => resolveAspectRatio(generation), [generation]);
  const isVideo = generation?.mediaType === 'video' && Boolean(resolvedVideoUrl);
  const previewUrl = isVideo ? resolvedVideoUrl : resolvedImageUrl;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0D0E12]">
      <div
        className="relative mx-auto w-full max-w-[780px]"
        style={{ aspectRatio }}
      >
        {previewUrl ? (
          isVideo ? (
            <video
              src={previewUrl}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#1A1C22] to-[#0D0E12]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
          <p className="text-[12px] text-[#8B92A5]">{metadata}</p>
        </div>
      </div>
    </div>
  );
}
