import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "@promptstudio/system/components/ui";
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
  onCancel,
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

  // Track client-side media load failures so we can render the same dim
  // fallback text used by the server-side `failed` branch.
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false);
  useEffect(() => {
    setMediaLoadFailed(false);
  }, [previewUrl]);
  const handleMediaError = useCallback(() => {
    setMediaLoadFailed(true);
  }, []);

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
        className="render-outline"
        style={{ aspectRatio }}
      >
        {/* Fill gradient rising from bottom based on progress */}
        <div
          className="render-outline-fill"
          style={{ height: `${clampedProgress}%` }}
          aria-hidden="true"
        />
        {/* Cancel button — borderless ghost X, dim by default, brighter on hover/focus */}
        {onCancel ? (
          <button
            type="button"
            aria-label="Cancel render"
            title="Cancel render"
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-tool-text-disabled transition-colors hover:text-tool-text-primary focus-visible:text-tool-text-primary focus-visible:outline-none"
            onClick={() => onCancel(generation)}
          >
            <X size={14} />
          </button>
        ) : null}
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

  if (mediaLoadFailed) {
    return (
      <div className="mx-auto flex max-w-[780px] items-center justify-center py-16">
        <p className="text-sm text-tool-text-disabled">
          Preview unavailable
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
          onError={handleMediaError}
        />
      ) : (
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full rounded-[14px] object-cover ps-animate-fade-in"
          onError={handleMediaError}
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
