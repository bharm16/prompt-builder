import React from "react";
import { cn } from "@/utils/cn";

export interface MotionIdeasPanelProps {
  ideas: string[];
  isLoading: boolean;
  onChipClick: (idea: string) => void;
  onReroll: () => void;
  className?: string;
}

const SKELETON_COUNT = 3;

export function MotionIdeasPanel({
  ideas,
  isLoading,
  onChipClick,
  onReroll,
  className,
}: MotionIdeasPanelProps): React.ReactElement {
  return (
    <section
      className={cn(
        "border-border bg-surface-1 mt-2 rounded-lg border p-3",
        className,
      )}
      aria-label="Motion ideas for the start image"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-label-sm text-muted font-semibold uppercase tracking-wide">
          Motion ideas
        </span>
        <button
          type="button"
          onClick={onReroll}
          disabled={isLoading}
          className="text-label-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Regenerate motion ideas"
        >
          New ideas
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-2 h-7 w-32 animate-pulse rounded-full"
                aria-hidden="true"
              />
            ))
          : ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => onChipClick(idea)}
                className="bg-surface-2 hover:bg-surface-3 text-body-sm text-foreground rounded-full px-3 py-1 transition-colors"
                aria-label={`Insert motion phrase: ${idea}`}
              >
                {idea}
              </button>
            ))}
      </div>
    </section>
  );
}
