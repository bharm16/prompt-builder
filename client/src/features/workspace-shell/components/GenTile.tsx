import React from "react";
import { cn } from "@/utils/cn";
import type { Generation } from "@features/generations/types";
import { dispatchContinueScene } from "../events";

export interface GenTileProps {
  generation: Generation;
  isFeatured: boolean;
  onSelect: () => void;
  onRetry: () => void;
}

export function GenTile({
  generation,
  isFeatured,
  onSelect,
  onRetry,
}: GenTileProps): React.ReactElement {
  const status = generation.status;
  const dataState =
    status === "completed"
      ? "ready"
      : status === "generating"
        ? "rendering"
        : status === "pending"
          ? "queued"
          : "failed";

  return (
    <article
      data-state={dataState}
      data-generation-id={generation.id}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-lg border border-tool-rail-border bg-tool-surface-card",
        isFeatured && "ring-2 ring-tool-accent-neutral/40",
        status === "completed" && "cursor-pointer",
      )}
      onClick={status === "completed" ? onSelect : undefined}
    >
      {status === "pending" && <QueuedPlaceholder />}
      {status === "generating" && <RenderingPlaceholder />}
      {status === "completed" && <ReadyMedia generation={generation} />}
      {status === "failed" && <FailedState onRetry={onRetry} />}

      {status === "completed" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="pointer-events-auto rounded-md bg-tool-surface-deep/80 px-2 py-1 text-[10px] font-medium text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            Open
          </button>
          {isFeatured && (
            <button
              type="button"
              className="pointer-events-auto rounded-md bg-tool-accent-neutral px-2 py-1 text-[10px] font-semibold text-tool-surface-deep"
              onClick={(e) => {
                e.stopPropagation();
                dispatchContinueScene({ fromGenerationId: generation.id });
              }}
            >
              Continue scene
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function QueuedPlaceholder(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="rounded-full border border-tool-rail-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tool-text-subdued">
        queued
      </span>
    </div>
  );
}

function RenderingPlaceholder(): React.ReactElement {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 animate-pulse bg-tool-rail-border/40" />
      <div className="absolute inset-x-0 bottom-2 text-center">
        <span className="rounded-full border border-tool-rail-border bg-tool-surface-deep/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--tool-status-rendering,#d4b486)]">
          rendering
        </span>
      </div>
    </div>
  );
}

function ReadyMedia({
  generation,
}: {
  generation: Generation;
}): React.ReactElement {
  // Phase 2 baseline: poster-first. No <video> elements per shot to avoid
  // 32+ concurrent autoplays. Phase 2.5 (out of scope here) introduces
  // on-interaction video swap for the featured tile.
  const poster = generation.thumbnailUrl ?? generation.mediaUrls[0] ?? "";
  return (
    <img
      src={poster}
      alt="Generation preview"
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}

function FailedState({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
      <p className="text-xs text-tool-text-subdued">Render failed.</p>
      <button
        type="button"
        className="rounded-md border border-tool-rail-border px-2 py-1 text-[10px] font-semibold text-tool-text-dim hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
      >
        Retry
      </button>
    </div>
  );
}
