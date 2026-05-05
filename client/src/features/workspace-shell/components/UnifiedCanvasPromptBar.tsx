import React from "react";
import { cn } from "@/utils/cn";
import { PromptEditorSurface } from "./PromptEditorSurface";
import type { PromptEditorSurfaceProps } from "./PromptEditorSurface";
import type { WorkspaceMoment } from "../utils/computeWorkspaceMoment";

export interface UnifiedCanvasPromptBarProps {
  moment: WorkspaceMoment;
  surfaceProps: PromptEditorSurfaceProps;
  /** Phase 3 will mount the TuneDrawer above the editor; Phase 1 leaves this null. */
  tuneSlot?: React.ReactNode;
  /** Phase 3 will add a CostPreview + Make-it submit row; Phase 1 leaves this null. */
  chromeSlot?: React.ReactNode;
}

/**
 * Floating glass composer for the unified workspace.
 *
 * Always docked at bottom-center; never reflows between WorkspaceMoments.
 * The Tune drawer (Phase 3) renders above the editor surface; the surface
 * grows upward while the bottom edge stays pinned at
 * --workspace-composer-bottom from the canvas bottom.
 */
export function UnifiedCanvasPromptBar({
  moment,
  surfaceProps,
  tuneSlot = null,
  chromeSlot = null,
}: UnifiedCanvasPromptBarProps): React.ReactElement {
  // moment is plumbed in for future use (e.g. dimming the Make-it CTA while
  // rendering); Phase 1 does not need to branch on it.
  void moment;

  return (
    <div
      className={cn(
        "absolute left-1/2 z-10 -translate-x-1/2",
        "w-[min(100%-48px,var(--workspace-composer-max-w))]",
        "rounded-[14px] border border-white/[0.08]",
        "bg-tool-surface-prompt/[0.72] backdrop-blur-[18px] backdrop-saturate-150",
        "shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4)]",
        "transition-[transform,box-shadow] duration-[240ms]",
      )}
      style={{ bottom: "var(--workspace-composer-bottom)" }}
    >
      {tuneSlot}
      <PromptEditorSurface {...surfaceProps} variant="active" />
      {chromeSlot}
    </div>
  );
}
