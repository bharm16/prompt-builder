import React, { useEffect, useMemo, useState } from "react";
import { useResolvedMediaUrl } from "@/hooks/useResolvedMediaUrl";
import { extractStorageObjectPath } from "@/utils/storageUrl";
import {
  formatRelativeTime,
  getModelConfig,
} from "@features/generations/config/generationConfig";
import type { Generation } from "@features/generations/types";
import { getGenerationProgressPercent } from "@features/generations/utils/generationProgress";
import { resolvePrimaryVideoSource } from "@features/generations/utils/videoSource";

interface CanvasHeroViewerProps {
  generation: Generation | null;
  onCancel?: ((generation: Generation) => void) | undefined;
}

const resolveTierLabel = (generation: Generation | null): string => {
  if (!generation) return "—";
  if (generation.mediaType === "image-sequence") return "preview";
  if (generation.tier === "draft") return "draft";
  return "final";
};

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveAspectRatio = (generation: Generation | null): string => {
  if (!generation?.aspectRatio) return "16 / 9";
  const [left, right] = generation.aspectRatio.split(":");
  const leftNumber = Number.parseFloat(left ?? "");
  const rightNumber = Number.parseFloat(right ?? "");
  if (
    !Number.isFinite(leftNumber) ||
    !Number.isFinite(rightNumber) ||
    leftNumber <= 0 ||
    rightNumber <= 0
  ) {
    return "16 / 9";
  }
  return `${leftNumber} / ${rightNumber}`;
};

export function CanvasHeroViewer({
  generation,
}: CanvasHeroViewerProps): React.ReactElement | null {
  const rawPrimaryMediaUrl = useMemo(
    () => normalizeUrl(generation?.mediaUrls[0] ?? null),
    [generation?.mediaUrls],
  );
  const rawThumbnailUrl = useMemo(
    () => normalizeUrl(generation?.thumbnailUrl ?? null),
    [generation?.thumbnailUrl],
  );
  const primaryMediaRef = generation?.mediaAssetIds?.[0] ?? null;
  const { storagePath: videoStoragePath, assetId: videoAssetId } = useMemo(
    () => resolvePrimaryVideoSource(rawPrimaryMediaUrl, primaryMediaRef),
    [primaryMediaRef, rawPrimaryMediaUrl],
  );
  const { url: resolvedVideoUrl } = useResolvedMediaUrl({
    kind: "video",
    url: rawPrimaryMediaUrl,
    storagePath: videoStoragePath,
    assetId: videoAssetId,
    deferUntilResolved: true,
    enabled: Boolean(
      generation &&
        generation.mediaType === "video" &&
        (rawPrimaryMediaUrl || videoStoragePath || videoAssetId),
    ),
  });

  const fallbackImageUrl = useMemo(() => {
    if (generation?.mediaType === "video") {
      return rawThumbnailUrl;
    }
    return rawThumbnailUrl ?? rawPrimaryMediaUrl;
  }, [generation?.mediaType, rawPrimaryMediaUrl, rawThumbnailUrl]);
  const fallbackImageStoragePath = useMemo(
    () =>
      fallbackImageUrl ? extractStorageObjectPath(fallbackImageUrl) : null,
    [fallbackImageUrl],
  );
  const { url: resolvedImageUrl } = useResolvedMediaUrl({
    kind: "image",
    url: fallbackImageUrl,
    storagePath: fallbackImageStoragePath,
    deferUntilResolved: true,
    enabled: Boolean(fallbackImageUrl),
  });

  const metadata = useMemo(() => {
    if (!generation || generation.status !== "completed") return null;

    const parts = [
      resolveTierLabel(generation),
      generation.duration ? `${generation.duration}s` : null,
      getModelConfig(generation.model)?.label ?? generation.model,
      formatRelativeTime(generation.completedAt ?? generation.createdAt),
    ].filter(Boolean);
    return parts.join(" · ");
  }, [generation]);

  const aspectRatio = useMemo(
    () => resolveAspectRatio(generation),
    [generation],
  );
  const isVideo =
    generation?.mediaType === "video" && Boolean(resolvedVideoUrl);
  const previewUrl = isVideo ? resolvedVideoUrl : resolvedImageUrl;
  const isGenerating =
    generation?.status === "pending" || generation?.status === "generating";
  const isFailed = generation?.status === "failed";

  // Tick every second while generating so progress updates
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
    const progress =
      getGenerationProgressPercent(generation, Date.now()) ??
      (generation.status === "pending" ? 5 : 10);
    const clampedProgress = Math.max(0, Math.min(100, progress));

    return (
      <div
        key={generation.id}
        className="relative mx-auto flex w-full max-w-[780px] flex-col items-center justify-center"
        style={{
          aspectRatio,
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '14px',
          animation: 'outline-breathe 3s ease-in-out infinite',
        }}
      >
        {/* Fill gradient rising from bottom based on progress */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 transition-[height] duration-[2000ms] ease-out"
          style={{
            height: `${clampedProgress}%`,
            background: 'linear-gradient(to top, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
            borderRadius: '0 0 13px 13px',
          }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="mx-auto flex max-w-[780px] items-center justify-center py-16">
        <p className="text-sm text-tool-text-disabled">
          Generation failed{generation.error ? ` \u00B7 ${generation.error}` : ''}
        </p>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="mx-auto flex max-w-[780px] items-center justify-center py-16">
        <p className="text-sm text-tool-text-disabled">
          Generation unavailable
        </p>
      </div>
    );
  }

  return (
    <div
      key={generation.id}
      className="relative mx-auto w-full max-w-[780px]"
      style={{ aspectRatio }}
    >
      {isVideo ? (
        <video
          src={previewUrl}
          className="h-full w-full rounded-[14px] object-cover ps-animate-fade-in"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full rounded-[14px] object-cover ps-animate-fade-in"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      {metadata ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[14px] bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
          <p className="text-[12px] text-tool-text-dim">{metadata}</p>
        </div>
      ) : null}
    </div>
  );
}
