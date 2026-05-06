import React, { useEffect } from "react";
import { cn } from "@/utils/cn";
import { PromptEditorSurface } from "./PromptEditorSurface";
import type { PromptEditorSurfaceProps } from "./PromptEditorSurface";
import { addContinueSceneListener } from "../events";

export interface CanvasPromptBarProps {
  surfaceProps: PromptEditorSurfaceProps;
  /** Called when a featured tile dispatches CONTINUE_SCENE. */
  onContinueScene?: (fromGenerationId: string) => void;
  /** TuneDrawer slot — renders above the editor when open. */
  tuneSlot?: React.ReactNode;
  /** CostPreview + settings row below the editor. */
  chromeSlot?: React.ReactNode;
}

/**
 * Floating glass composer for the unified workspace.
 *
 * Always docked at bottom-center; never reflows between WorkspaceMoments.
 * The Tune drawer renders above the editor surface; the surface grows
 * upward while the bottom edge stays pinned at --workspace-composer-bottom
 * from the canvas bottom.
 */
export function CanvasPromptBar({
  surfaceProps,
  onContinueScene,
  tuneSlot = null,
  chromeSlot = null,
}: CanvasPromptBarProps): React.ReactElement {
  useEffect(() => {
    if (!onContinueScene) return;
    return addContinueSceneListener((event) => {
      onContinueScene(event.detail.fromGenerationId);
    });
  }, [onContinueScene]);

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
