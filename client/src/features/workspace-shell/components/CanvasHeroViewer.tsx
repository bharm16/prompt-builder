import React, { useEffect, useMemo, useState } from "react";
import { WarningCircle } from "@promptstudio/system/components/ui";
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

const formatElapsed = (createdAt: number): string => {
  const elapsedMs = Date.now() - createdAt;
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const resolveProgressLabel = (generation: Generation): string => {
  if (generation.serverJobStatus === "queued") return "Queued";
  if (generation.status === "pending") return "Starting";
  return "Rendering";
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
    const progress =
      getGenerationProgressPercent(generation, Date.now()) ??
      (generation.status === "pending" ? 5 : 10);
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
          {/* Atmospheric aurora background */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
            aria-hidden="true"
          >
            <div
              className="motion-aurora absolute inset-[-50%] h-[200%] w-[200%]"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(124,58,237,0.13), rgba(59,130,246,0.13), rgba(6,182,212,0.13), rgba(124,58,237,0.13))",
                animation: "aurora-rotate 12s linear infinite",
                filter: "blur(60px)",
              }}
            />
          </div>

          {/* Cancel button */}
          {onCancel ? (
            <button
              type="button"
              aria-label="Cancel render"
              className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
              onClick={() => {
                if (generation) {
                  onCancel(generation);
                }
              }}
            >
              Cancel
            </button>
          ) : null}

          {/* Progress content (center) */}
          <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
            <span className="text-2xl font-semibold tabular-nums text-foreground/90">
              {clampedProgress}%
            </span>

            <div className="space-y-1.5">
              <p className="text-sm font-medium tracking-wide text-foreground/80">
                {stageLabel}
              </p>
              <p className="text-xs tabular-nums text-tool-text-subdued">
                {modelLabel} &middot; {elapsed}
                {eta ? ` \u00B7 est. ${eta}` : ""}
              </p>
            </div>
          </div>

          {/* Bottom progress bar */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-[width] duration-700 ease-out"
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
            <WarningCircle
              size={28}
              className="text-danger/80"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Generation failed
              </p>
              <p className="text-xs text-tool-text-subdued">
                {generation.error ?? "Unable to load this generation."}
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
            <WarningCircle
              size={28}
              className="text-tool-text-dim"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Generation unavailable
              </p>
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
