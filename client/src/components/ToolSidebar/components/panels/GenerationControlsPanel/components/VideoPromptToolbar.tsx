import React from 'react';
import { Copy, Trash2, Wand2 } from '@promptstudio/system/components/ui';

interface VideoPromptToolbarProps {
  canCopy: boolean;
  canClear: boolean;
  onCopy: () => void;
  onClear: () => void;
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
  onCopy,
  onClear,
  promptLength = 0,
}: VideoPromptToolbarProps): React.ReactElement {
  return (
    <div className="h-[42px] border-t border-[#22252C] flex items-center px-2 gap-0.5">
      {/* ── Left: copy + clear ── */}
      <button
        type="button"
        aria-label="Copy text"
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#555B6E] hover:bg-[#22252C] hover:text-[#8B92A5] transition-colors disabled:opacity-50"
        onClick={onCopy}
        disabled={!canCopy}
      >
        <Copy className="w-[13px] h-[13px]" />
      </button>
      <button
        type="button"
        aria-label="Clear text"
        className="w-7 h-7 rounded-md flex items-center justify-center text-[#555B6E] hover:bg-[#22252C] hover:text-[#8B92A5] transition-colors disabled:opacity-50"
        onClick={onClear}
        disabled={!canClear}
      >
        <Trash2 className="w-[13px] h-[13px]" />
      </button>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Character count ── */}
      <span className="text-[10px] tabular-nums text-[#3A3E4C] mr-2">{promptLength}</span>

      {/* ── Split-action preview button [□ | □□□□] ── */}
      <div className="h-[26px] flex rounded-md overflow-hidden border border-[#22252C] bg-[#0D0E12]">
        <button
          type="button"
          aria-label="Generate 1 preview · 1 cr"
          title="Generate 1 preview · 1 cr"
          className="h-full px-[7px] flex items-center justify-center text-[#555B6E] hover:bg-[#22252C]/50 hover:text-[#E2E6EF] transition-colors relative"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
          </svg>
          <div className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-[#6C5CE7]" />
        </button>
        <div className="w-px h-[14px] self-center bg-[#22252C]" />
        <button
          type="button"
          aria-label="Generate 4 previews · ~4 cr"
          title="Generate 4 previews · ~4 cr"
          className="h-full px-[7px] flex items-center justify-center text-[#3A3E4C] hover:bg-[#22252C]/50 hover:text-[#E2E6EF] transition-colors"
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
        className="h-[26px] px-2.5 rounded-md border border-[#6C5CE744] bg-[#6C5CE711] text-[#6C5CE7] text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-[#6C5CE722] hover:border-[#6C5CE788] transition-colors"
      >
        <Wand2 className="w-[13px] h-[13px]" />
        AI Enhance
      </button>
    </div>
  );
}
