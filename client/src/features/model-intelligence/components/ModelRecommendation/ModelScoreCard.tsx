import React from "react";
import type { ModelScore } from "../../types";
import { ScoreBar } from "./ScoreBar";
import { RecommendationReasons } from "./RecommendationReasons";
import { cn } from "@/utils/cn";

interface ModelScoreCardProps {
  score: ModelScore;
  label: string;
  variant?: "primary" | "secondary";
  actionLabel?: string;
  onSelect?: (modelId: string) => void;
  showReasons?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: "border-tool-text-disabled bg-tool-nav-active",
  secondary: "border-tool-border-dark bg-tool-nav-active",
};

export function ModelScoreCard({
  score,
  label,
  variant = "secondary",
  actionLabel = "Use",
  onSelect,
  showReasons = true,
}: ModelScoreCardProps): React.ReactElement {
  return (
    <div className={cn("rounded-lg border p-3", variantStyles[variant])}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-white">{label}</div>
          <div className="text-[11px] text-ghost">
            {score.overallScore}% match
          </div>
        </div>
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(score.modelId)}
            className={cn(
              "h-7 px-2 rounded-md text-xs font-semibold",
              variant === "primary"
                ? "bg-white text-tool-surface-deep hover:opacity-90"
                : "border border-tool-border-dark text-ghost hover:bg-surface-1",
            )}
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="mt-2">
        <ScoreBar value={score.overallScore} />
      </div>

      {showReasons && (
        <RecommendationReasons
          score={score}
          showWarnings={variant === "secondary"}
        />
      )}
    </div>
  );
}
