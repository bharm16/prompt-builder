import React from 'react';
import { Copy, Trash2, Wand2 } from '@promptstudio/system/components/ui';

interface VideoPromptToolbarProps {
  canCopy: boolean;
  canClear: boolean;
  canGeneratePreviews: boolean;
  onCopy: () => void;
  onClear: () => void;
  onGenerateSinglePreview: () => void;
  onGenerateFourPreviews: () => void;
  promptLength?: number;
}

/**
 * Prompt card action bar matching v5 mockup:
 * [📋] [🗑] ———— 190  [□|□□□□]  [✨ AI Enhance]
 *
 * The [□|□□□□] is a split-action preview button:
 *   Left  → generate 1 Flux preview (1 cr)
 *   Right → generate 4 Flux previews (~4 cr)
 */
export function VideoPromptToolbar({
  canCopy,
  canClear,
  canGeneratePreviews,
  onCopy,
  onClear,
  onGenerateSinglePreview,
  onGenerateFourPreviews,
  promptLength = 0,
}: VideoPromptToolbarProps): React.ReactElement {
  return (
    <div className="h-[42px] border-t border-tool-nav-active flex items-center px-2 gap-0.5">
      {/* ── Left: copy + clear ── */}
      <button
        type="button"
        aria-label="Copy text"
        className="w-7 h-7 rounded-md flex items-center justify-center text-tool-text-subdued hover:bg-tool-nav-active hover:text-tool-text-dim transition-colors disabled:opacity-50"
        onClick={onCopy}
        disabled={!canCopy}
      >
        <Copy className="w-[13px] h-[13px]" />
      </button>
      <button
        type="button"
        aria-label="Clear text"
        className="w-7 h-7 rounded-md flex items-center justify-center text-tool-text-subdued hover:bg-tool-nav-active hover:text-tool-text-dim transition-colors disabled:opacity-50"
        onClick={onClear}
        disabled={!canClear}
      >
        <Trash2 className="w-[13px] h-[13px]" />
      </button>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Character count ── */}
      <span className="text-[10px] tabular-nums text-tool-text-label mr-2">{promptLength}</span>

      {/* ── Split-action preview button [□ | □□□□] ── */}
      <div className="h-[26px] flex rounded-md overflow-hidden border border-tool-nav-active bg-tool-surface-deep">
        <button
          type="button"
          aria-label="Generate 1 preview · 1 cr"
          title="Generate 1 preview · 1 cr"
          className="h-full px-[7px] flex items-center justify-center text-tool-text-subdued hover:bg-tool-nav-active/50 hover:text-foreground transition-colors relative disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onGenerateSinglePreview}
          disabled={!canGeneratePreviews}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
          </svg>
          <div className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-tool-accent-selection" />
        </button>
        <div className="w-px h-[14px] self-center bg-tool-nav-active" />
        <button
          type="button"
          aria-label="Generate 4 previews · ~4 cr"
          title="Generate 4 previews · ~4 cr"
          className="h-full px-[7px] flex items-center justify-center text-tool-text-label hover:bg-tool-nav-active/50 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onGenerateFourPreviews}
          disabled={!canGeneratePreviews}
        >
          <svg width="22" height="13" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3.5" width="4" height="7" rx="0.8" />
            <rect x="6" y="3.5" width="4" height="7" rx="0.8" />
            <rect x="11" y="3.5" width="4" height="7" rx="0.8" />
            <rect x="16" y="3.5" width="4" height="7" rx="0.8" />
          </svg>
        </button>
      </div>

      <div className="w-1" />

      {/* ── AI Enhance ── */}
      <button
        type="button"
        aria-label="AI Enhance"
        className="h-[26px] px-2.5 rounded-md border border-tool-accent-selection/25 bg-tool-accent-selection/5 text-tool-accent-selection text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-tool-accent-selection/13 hover:border-tool-accent-selection/50 transition-colors"
      >
        <Wand2 className="w-[13px] h-[13px]" />
        AI Enhance
      </button>
    </div>
  );
}
