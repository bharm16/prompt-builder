import React, { useEffect, useMemo, useState } from 'react';
import { WarningCircle } from '@promptstudio/system/components/ui';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { extractStorageObjectPath } from '@/utils/storageUrl';
import { formatRelativeTime, getModelConfig } from '@features/generations/config/generationConfig';
import type { Generation } from '@features/generations/types';
import { resolvePrimaryVideoSource } from '@features/generations/utils/videoSource';

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

const formatElapsed = (createdAt: number): string => {
  const elapsedMs = Date.now() - createdAt;
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const resolveProgressLabel = (generation: Generation): string => {
  if (generation.status === 'pending') return 'Queued';
  return 'Rendering';
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
    if (!generation || generation.status !== 'completed') return null;

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
  const isGenerating =
    generation?.status === 'pending' || generation?.status === 'generating';
  const isFailed = generation?.status === 'failed';

  // Tick every second while generating so elapsed time updates
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Don't render the viewer chrome when there are no generations at all.
  // The prompt bar fills the space instead of showing an empty player shell.
  if (!generation) return null;

  if (isGenerating) {
    const progress = generation.serverProgress ?? (generation.status === 'pending' ? 5 : 10);
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const modelConfig = getModelConfig(generation.model);
    const modelLabel = modelConfig?.label ?? generation.model;
    const eta = modelConfig?.eta ?? null;
    const stageLabel = resolveProgressLabel(generation);
    const elapsed = formatElapsed(generation.createdAt);

    return (
      <div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">
        <div
          key={generation.id}
          className="relative mx-auto flex w-full max-w-[780px] flex-col items-center justify-center bg-gradient-to-br from-tool-rail-border to-tool-surface-deep"
          style={{ aspectRatio }}
        >
          {/* Central progress content */}
          <div className="flex flex-col items-center gap-5 px-6 text-center">
            {/* Pulsing ring indicator */}
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-tool-text-dim/15"
                />
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="text-foreground/80 transition-[stroke-dashoffset] duration-700 ease-out"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - clampedProgress / 100)}`}
                />
              </svg>
              <span className="absolute text-xs font-medium tabular-nums text-foreground">
                {clampedProgress}%
              </span>
            </div>

            {/* Status text */}
            <div className="space-y-1.5">
              <p className="text-sm font-semibold tracking-wide text-foreground">
                {stageLabel}
              </p>
              <p className="text-xs tabular-nums text-tool-text-subdued">
                {modelLabel} · {elapsed}{eta ? ` · est. ${eta}` : ''}
              </p>
            </div>
          </div>

          {/* Bottom progress track */}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-tool-text-dim/10">
            <div
              className="h-full bg-foreground/50 transition-[width] duration-700 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">
        <div
          key={generation.id}
          className="relative mx-auto flex w-full max-w-[780px] items-center justify-center bg-tool-surface-deep px-6"
          style={{ aspectRatio }}
        >
          <div className="flex max-w-[360px] flex-col items-center gap-3 text-center">
            <WarningCircle size={28} className="text-danger/80" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Generation failed</p>
              <p className="text-xs text-tool-text-subdued">
                {generation.error ?? 'Unable to load this generation.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">
        <div
          key={generation.id}
          className="relative mx-auto flex w-full max-w-[780px] items-center justify-center bg-gradient-to-br from-tool-rail-border to-tool-surface-deep px-6"
          style={{ aspectRatio }}
        >
          <div className="flex max-w-[360px] flex-col items-center gap-3 text-center">
            <WarningCircle size={28} className="text-tool-text-dim" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Generation unavailable</p>
              <p className="text-xs text-tool-text-subdued">
                No media is available for this generation.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">
      <div
        key={generation.id}
        className="relative mx-auto w-full max-w-[780px]"
        style={{ aspectRatio }}
      >
        {isVideo ? (
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
        )}
        {metadata ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
            <p className="text-[12px] text-tool-text-dim">{metadata}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
