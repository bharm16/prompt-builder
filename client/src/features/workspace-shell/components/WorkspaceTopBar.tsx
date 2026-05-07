import React from "react";
import {
  CaretDown,
  CaretRight,
  Search,
} from "@promptstudio/system/components/ui";
import { cn } from "@/utils/cn";
import { useWorkspaceProject } from "../hooks/useWorkspaceProject";
import { useWorkspaceCredits } from "../hooks/useWorkspaceCredits";

const MODES = [
  { id: "image", label: "Image", active: false },
  { id: "video", label: "Video", active: true },
  { id: "audio", label: "Audio", active: false },
  { id: "3d", label: "3D", active: false },
] as const;

/* Vidra wordmark — rotated-square mark + text. Inline SVG so the logo travels
   with the component without a separate asset request. */
function VidraMark(): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-2 text-foreground">
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="12"
          height="12"
          rx="1.5"
          transform="rotate(45 9 9)"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M9 4.5L9 13.5M4.5 9L13.5 9"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.6"
        />
      </svg>
      <span className="text-sm font-medium tracking-tight">Vidra</span>
    </span>
  );
}

export function WorkspaceTopBar(): React.ReactElement {
  const project = useWorkspaceProject();
  const credits = useWorkspaceCredits();

  return (
    <header
      className="flex h-[var(--workspace-topbar-h)] items-center gap-3 border-b border-tool-rail-border bg-tool-surface-deep px-4"
      role="banner"
    >
      <VidraMark />
      <CaretRight size={12} className="text-tool-text-subdued" weight="bold" />
      {/*
        Static project label until a real project store + persistence land. A
        clickable rename was previously wired to component-state-only, which
        silently dropped the new name on remount — see UX rule "browsing is
        read-only, editing is explicit". The CaretDown is decorative until the
        project switcher menu lands.
      */}
      <span className="inline-flex items-center gap-1 px-1 py-1 text-sm text-foreground">
        {project.name}
        <CaretDown
          size={12}
          className="text-tool-text-subdued"
          aria-hidden="true"
        />
      </span>

      <div className="flex-1" />

      <nav
        role="tablist"
        aria-label="Output mode"
        className="flex items-center gap-1 rounded-full border border-tool-rail-border bg-tool-surface-card/50 p-1"
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
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
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
        title={`${credits.credits.toLocaleString()} credits`}
      >
        {credits.credits.toLocaleString()}
        <span className="ml-1 text-tool-text-subdued">cr</span>
      </span>
      {/*
        Search and Share are visual-only until their backing flows land. Match
        the MODES tablist pattern: aria-disabled + cursor-not-allowed + title,
        so screen-reader users can discover the "Coming soon" state and
        keyboard users aren't lured into pressing inert controls.
      */}
      <button
        type="button"
        aria-label="Search"
        aria-disabled="true"
        title="Coming soon"
        className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full text-tool-text-subdued opacity-50"
      >
        <Search size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-disabled="true"
        title="Coming soon"
        className="inline-flex h-8 cursor-not-allowed items-center rounded-full bg-foreground px-4 text-xs font-medium text-tool-surface-deep opacity-60"
      >
        Share
      </button>
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
