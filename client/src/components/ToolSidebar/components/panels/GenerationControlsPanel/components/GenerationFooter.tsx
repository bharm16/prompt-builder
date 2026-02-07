import React from 'react';
import { ChevronDown, Sparkles } from '@promptstudio/system/components/ui';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';

interface ModelOption {
  id: string;
  label: string;
}

interface GenerationFooterProps {
  renderModelOptions: ModelOption[];
  renderModelId: string;
  onModelChange: (model: string) => void;
  onGenerate: () => void;
  isGenerateDisabled: boolean;
  generateLabel?: string;
}

/**
 * Footer matching v5 mockup (64px):
 * [Sora 2 ▾] · 80 cr ——————— [✨ Generate]
 *
 * Tier is derived from the selected model — if it matches the draft model ID
 * the cost shown is the draft cost, otherwise the render model cost.
 */
export function GenerationFooter({
  renderModelOptions,
  renderModelId,
  onModelChange,
  onGenerate,
  isGenerateDisabled,
  generateLabel = 'Generate',
}: GenerationFooterProps): React.ReactElement {
  const isDraft = renderModelId === VIDEO_DRAFT_MODEL.id;
  const currentModel = isDraft
    ? VIDEO_DRAFT_MODEL
    : VIDEO_RENDER_MODELS.find((m) => m.id === renderModelId) ?? VIDEO_RENDER_MODELS[0];

  const creditCost = currentModel?.cost ?? null;

  return (
    <footer className="h-16 px-3.5 flex items-center gap-2.5 border-t border-[#1A1C22] bg-[linear-gradient(180deg,#111318_0%,#0D0E12_100%)]">
      {/* ── Model selector ── */}
      <div className="relative inline-block">
        <select
          value={renderModelId}
          onChange={(event) => onModelChange(event.target.value)}
          className="h-9 pl-3 pr-7 rounded-lg bg-[#16181E] border border-[#22252C] text-[#E2E6EF] text-xs font-semibold appearance-none cursor-pointer hover:border-[#3A3D46] transition-colors focus:outline-none focus:border-[#6C5CE7]"
          aria-label="Video model"
        >
          {renderModelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-2.5 h-2.5 text-[#8B92A5] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* ── Credit cost ── */}
      <span className="text-[11px] text-[#555B6E] tabular-nums whitespace-nowrap">
        {creditCost !== null ? `· ${creditCost} cr` : ''}
      </span>

      <div className="flex-1" />

      {/* ── Generate button ── */}
      <button
        type="button"
        className="h-[38px] px-5 rounded-[10px] bg-[linear-gradient(135deg,#6C5CE7_0%,#8B5CF6_100%)] text-white text-[13px] font-bold tracking-[0.02em] shadow-[0_2px_12px_rgba(108,92,231,0.33),0_0_0_1px_rgba(108,92,231,0.2)] hover:shadow-[0_4px_20px_rgba(108,92,231,0.47),0_0_0_1px_rgba(108,92,231,0.33)] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_12px_rgba(108,92,231,0.33),0_0_0_1px_rgba(108,92,231,0.2)] transition-all flex items-center gap-[7px]"
        onClick={onGenerate}
        disabled={isGenerateDisabled}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {generateLabel}
      </button>
    </footer>
  );
}
