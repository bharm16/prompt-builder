import React, { useMemo } from 'react';
import { formatRelativeTime } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { getModelConfig } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';

interface CanvasHeroViewerProps {
  generation: Generation | null;
}

const resolveTierLabel = (generation: Generation | null): string => {
  if (!generation) return '—';
  if (generation.mediaType === 'image-sequence') return 'preview';
  if (generation.tier === 'draft') return 'draft';
  return 'final';
};

const resolvePreviewUrl = (generation: Generation | null): string | null => {
  if (!generation) return null;
  if (generation.thumbnailUrl && generation.thumbnailUrl.trim().length > 0) {
    return generation.thumbnailUrl.trim();
  }
  return generation.mediaUrls[0] ?? null;
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
  const previewUrl = useMemo(() => resolvePreviewUrl(generation), [generation]);
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
  const isVideo = generation?.mediaType === 'video' && Boolean(previewUrl);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0D0E12]">
      <div
        className="mx-auto w-full max-w-[780px]"
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
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
        <p className="text-[12px] text-[#8B92A5]">{metadata}</p>
      </div>
    </div>
  );
}

