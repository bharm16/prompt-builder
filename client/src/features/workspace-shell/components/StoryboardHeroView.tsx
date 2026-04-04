import React, { useEffect, useMemo, useState } from "react";
import { WarningCircle } from "@promptstudio/system/components/ui";
import type { KeyframeTile } from "@/components/ToolSidebar/types";
import type { Generation } from "@features/generations/types";
import { cn } from "@/utils/cn";

interface StoryboardHeroViewProps {
  generation: Generation;
  onUseAsStartFrame: (frame: KeyframeTile) => void;
}

const resolveFrameAssetMetadata = (
  generation: Generation,
  frameIndex: number,
): Pick<KeyframeTile, "assetId" | "storagePath"> => {
  const value = generation.mediaAssetIds?.[frameIndex];
  if (!value) return {};
  if (value.includes("/")) {
    return { storagePath: value };
  }
  return { assetId: value };
};

const resolveGridColumnsClass = (count: number): string => {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-2";
};

export function StoryboardHeroView({
  generation,
  onUseAsStartFrame,
}: StoryboardHeroViewProps): React.ReactElement {
  const frames = useMemo(
    () =>
      generation.mediaUrls
        .filter((url) => typeof url === "string" && url.trim().length > 0)
        .slice(0, 4),
    [generation.mediaUrls],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [generation.id]);

  const safeSelectedIndex =
    selectedIndex >= 0 && selectedIndex < frames.length ? selectedIndex : 0;
  const selectedFrameUrl =
    safeSelectedIndex >= 0 && safeSelectedIndex < frames.length
      ? (frames[safeSelectedIndex] ?? null)
      : null;

  if (generation.status === "pending" || generation.status === "generating") {
    return (
      <div className="flex h-full min-h-[280px] flex-col gap-3 rounded-2xl bg-tool-surface-deep p-3">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={`storyboard-loading-${index}`}
              className="aspect-video animate-pulse rounded-lg border border-tool-nav-active bg-tool-rail-border"
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold tracking-[0.05em] text-faint/40">
            PREVIEW · GENERATING
          </span>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-faint/40 border-t-foreground" />
        </div>
      </div>
    );
  }

  if (generation.status === "failed") {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border border-tool-nav-active bg-tool-surface-deep p-6">
        <WarningCircle
          size={24}
          className="text-danger/80"
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-foreground">
          Storyboard failed
        </span>
        <span className="text-center text-xs text-tool-text-subdued">
          {generation.error ?? "Unable to load storyboard preview."}
        </span>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-tool-nav-active bg-tool-surface-deep">
        <span className="text-xs text-tool-text-subdued">
          No storyboard frames available.
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-tool-surface-deep p-3">
      <div className={cn("grid gap-2", resolveGridColumnsClass(frames.length))}>
        {frames.map((url, index) => (
          <button
            key={`${generation.id}-frame-${index}`}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "aspect-video overflow-hidden rounded-lg border-2 transition-all",
              safeSelectedIndex === index
                ? "border-accent-2 shadow-[0_0_16px_var(--ps-accent-2,#b3affd)44]"
                : "border-transparent hover:border-tool-nav-active",
            )}
            data-testid={`storyboard-hero-frame-${index}`}
          >
            <img
              src={url}
              alt={`Frame ${index + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold tracking-[0.05em] text-faint/40">
          PREVIEW · {frames.length} FRAMES
        </span>
        <button
          type="button"
          className="rounded-md border border-accent-2/25 bg-accent-2/5 px-3 py-1.5 text-[11px] font-semibold text-accent-2 transition-colors hover:bg-accent-2/10"
          onClick={() => {
            if (!selectedFrameUrl) return;
            onUseAsStartFrame({
              id: `storyboard-${generation.id}-frame-${safeSelectedIndex}`,
              url: selectedFrameUrl,
              source: "generation",
              ...(generation.prompt ? { sourcePrompt: generation.prompt } : {}),
              ...resolveFrameAssetMetadata(generation, safeSelectedIndex),
            });
          }}
          disabled={!selectedFrameUrl}
          data-testid="storyboard-hero-use-start-frame"
        >
          Use as start frame
        </button>
      </div>
    </div>
  );
}
