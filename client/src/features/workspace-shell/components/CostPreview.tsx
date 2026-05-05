import React from "react";

export interface CostPreviewProps {
  cost: number;
}

/**
 * "~22 cr / shot" label rendered next to the Make-it submit button.
 * Hides itself entirely when cost is 0 (e.g. unknown model with no
 * exposed pricing) so the UI doesn't show a misleading number.
 */
export function CostPreview({
  cost,
}: CostPreviewProps): React.ReactElement | null {
  if (cost <= 0) return null;
  return (
    <span
      className="font-mono text-[11px] text-tool-text-dim"
      aria-label={`Estimated cost ${cost} credits per shot`}
    >
      ~{cost} cr / shot
    </span>
  );
}
