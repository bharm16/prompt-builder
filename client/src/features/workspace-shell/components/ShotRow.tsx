import React from "react";
import { cn } from "@/utils/cn";
import type { Shot } from "../utils/groupShots";
import { formatRelative } from "../utils/formatRelative";
import { GenTile } from "./GenTile";

export interface ShotRowProps {
  shot: Shot;
  layout: "featured" | "compact";
  /** id of the featured tile within this shot, or null. */
  featuredTileId: string | null;
  /**
   * Wall-clock timestamp used to format the relative "5m ago" label.
   * Owned by the caller so the row stays presentational + storybook-stable.
   */
  now: number;
  onSelectTile: (generationId: string) => void;
  onRetryTile: (generationId: string) => void;
}

const STATUS_PILL_CLASS: Record<Shot["status"], string> = {
  ready: "text-[var(--tool-status-ready,#9ec4a8)]",
  rendering: "text-[var(--tool-status-rendering,#d4b486)]",
  queued: "text-tool-text-subdued",
  failed: "text-red-400",
  mixed: "text-[var(--tool-status-rendering,#d4b486)]",
};

export function ShotRow({
  shot,
  layout,
  featuredTileId,
  now,
  onSelectTile,
  onRetryTile,
}: ShotRowProps): React.ReactElement {
  return (
    <section
      data-layout={layout}
      aria-labelledby={`shot-${shot.id}-header`}
      className="rounded-lg border border-tool-rail-border bg-tool-surface-card/40 p-4"
    >
      <header
        id={`shot-${shot.id}-header`}
        className="mb-3 flex items-center gap-3"
      >
        <h2 className="m-0 flex-1 truncate text-sm font-medium text-foreground">
          {shot.promptSummary || "Untitled shot"}
        </h2>
        <span
          className={cn(
            "rounded-full border border-tool-rail-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
            STATUS_PILL_CLASS[shot.status],
          )}
        >
          {shot.status}
        </span>
        <time className="font-mono text-[10px] text-tool-text-subdued">
          {formatRelative(shot.createdAt, now)}
        </time>
      </header>
      <div
        className={cn(
          "grid gap-3",
          layout === "featured"
            ? "grid-cols-2 lg:grid-cols-4"
            : "grid-cols-4 lg:grid-cols-6",
        )}
      >
        {shot.tiles.map((tile) => (
          <GenTile
            key={tile.id}
            generation={tile}
            isFeatured={tile.id === featuredTileId}
            onSelect={() => onSelectTile(tile.id)}
            onRetry={() => onRetryTile(tile.id)}
          />
        ))}
      </div>
    </section>
  );
}
