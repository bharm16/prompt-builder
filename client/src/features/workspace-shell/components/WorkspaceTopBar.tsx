import React, { useState } from "react";
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
      <InlineRename value={project.name} onCommit={project.rename} />
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
            disabled={!mode.active}
            type="button"
            title={mode.active ? undefined : "Coming soon"}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode.active
                ? "bg-tool-nav-active text-foreground"
                : "text-tool-text-subdued hover:text-tool-text-dim disabled:cursor-not-allowed disabled:opacity-50",
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

function InlineRename({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="rounded-md px-2 py-1 text-sm font-medium text-foreground hover:bg-tool-rail-border"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      className="rounded-md border border-tool-nav-active bg-tool-surface-prompt-compact px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-white/10"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft !== value) onCommit(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
