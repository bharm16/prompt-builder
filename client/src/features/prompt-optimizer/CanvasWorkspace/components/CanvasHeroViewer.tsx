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
}: CanvasHeroViewerProps): React.ReactElement | null {
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

  // Don't render the viewer chrome when there are no generations at all.
  // The prompt bar fills the space instead of showing an empty player shell.
  if (!generation) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">
      <div
        key={generation.id}
        className="relative mx-auto w-full max-w-[780px]"
        style={{ aspectRatio }}
      >
        {previewUrl ? (
          isVideo ? (
            <video
              src={previewUrl}
              className="h-full w-full object-cover ps-animate-fade-in"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover ps-animate-fade-in"
            />
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-tool-rail-border to-tool-surface-deep ps-animate-fade-in" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
          <p className="text-[12px] text-tool-text-dim">{metadata}</p>
        </div>
      </div>
    </div>
  );
}
