import React from "react";
import { cn } from "@/utils/cn";
import { useWorkspaceProject } from "../hooks/useWorkspaceProject";
import { useWorkspaceCredits } from "../hooks/useWorkspaceCredits";

const MODES = [
  { id: "image", label: "Image", active: false },
  { id: "video", label: "Video", active: true },
  { id: "audio", label: "Audio", active: false },
  { id: "3d", label: "3D", active: false },
] as const;

export function WorkspaceTopBar(): React.ReactElement {
  const project = useWorkspaceProject();
  const credits = useWorkspaceCredits();

  return (
    <header
      className="flex h-[var(--workspace-topbar-h)] items-center gap-4 border-b border-tool-rail-border bg-tool-surface-deep px-4"
      role="banner"
    >
      {/*
        Static label until a real project store + persistence land. A clickable
        rename was previously wired to component-state-only, which silently
        dropped the new name on remount — see UX rule "browsing is read-only,
        editing is explicit". We re-add the affordance when rename can survive.
      */}
      <span className="px-2 py-1 text-sm font-medium text-foreground">
        {project.name}
      </span>
      <nav
        role="tablist"
        aria-label="Output mode"
        className="flex items-center gap-1"
      >
        {MODES.map((mode) => (
          <button
            key={mode.id}
            role="tab"
            aria-selected={mode.active}
            aria-disabled={!mode.active}
            tabIndex={mode.active ? 0 : -1}
            type="button"
            title={mode.active ? undefined : "Coming soon"}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode.active
                ? "bg-tool-nav-active text-foreground"
                : "cursor-not-allowed text-tool-text-subdued opacity-50 hover:text-tool-text-dim",
            )}
          >
            {mode.label}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <span
        className="font-mono text-[11px] text-tool-text-dim"
        aria-label="Credits remaining"
      >
        {credits.credits.toLocaleString()} credits
      </span>
      {credits.avatarUrl ? (
        <img
          src={credits.avatarUrl}
          alt=""
          className="h-7 w-7 rounded-full border border-tool-rail-border"
        />
      ) : (
        <div className="h-7 w-7 rounded-full border border-tool-rail-border bg-tool-surface-card" />
      )}
    </header>
  );
}
