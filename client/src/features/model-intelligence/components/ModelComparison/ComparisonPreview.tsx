import React from "react";
import { cn } from "@/utils/cn";

interface ComparisonPreviewProps {
  label: string;
  imageUrl?: string;
  videoUrl?: string;
  className?: string;
}

export function ComparisonPreview({
  label,
  imageUrl,
  videoUrl,
  className,
}: ComparisonPreviewProps): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-md border border-surface-2 bg-tool-surface-card p-2",
        className,
      )}
    >
      <div className="text-[11px] text-ghost">{label}</div>
      <div className="mt-2 flex items-center justify-center rounded-md bg-tool-panel-inner text-[10px] text-tool-text-dim">
        {videoUrl ? (
          <video
            className="h-24 w-full rounded-md object-cover"
            src={videoUrl}
            muted
          />
        ) : imageUrl ? (
          <img
            className="h-24 w-full rounded-md object-cover"
            src={imageUrl}
            alt={label}
          />
        ) : (
          <div className="h-24 w-full flex items-center justify-center">
            No preview
          </div>
        )}
      </div>
    </div>
  );
}
