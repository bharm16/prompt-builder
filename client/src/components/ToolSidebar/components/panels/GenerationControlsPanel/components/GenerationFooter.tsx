import React from 'react';
import { Sparkles } from '@promptstudio/system/components/ui';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import { ModelRecommendationDropdown } from './ModelRecommendationDropdown';
import type { ModelRecommendation } from '@/features/model-intelligence/types';

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
  generateLabel?: string | undefined;
  /** Model recommendation data — enables the rich dropdown with match %, capabilities, etc. */
  modelRecommendation?: ModelRecommendation | null | undefined;
  recommendedModelId?: string | undefined;
  efficientModelId?: string | undefined;
}

/**
 * Footer matching v5 mockup (64px):
 * [Sora 2 ▾] · 80 cr ——————— [✨ Generate]
 *
 * Model selector uses the recommendation-aware dropdown when recommendation
 * data is available, falling back to a simpler version otherwise.
 */
export function GenerationFooter({
  renderModelOptions,
  renderModelId,
  onModelChange,
  onGenerate,
  isGenerateDisabled,
  generateLabel = 'Generate',
  modelRecommendation,
  recommendedModelId,
  efficientModelId,
}: GenerationFooterProps): React.ReactElement {
  const isDraft = renderModelId === VIDEO_DRAFT_MODEL.id;
  const currentModel = isDraft
    ? VIDEO_DRAFT_MODEL
    : VIDEO_RENDER_MODELS.find((m) => m.id === renderModelId) ?? VIDEO_RENDER_MODELS[0];

  const creditCost = currentModel?.cost ?? null;

  return (
    <footer className="flex h-16 items-center gap-2.5 border-t border-[#1A1C22] bg-[linear-gradient(180deg,#111318_0%,#0D0E12_100%)] px-3.5">
      {/* ── Model selector (recommendation-aware dropdown) ── */}
      <ModelRecommendationDropdown
        renderModelOptions={renderModelOptions}
        renderModelId={renderModelId}
        onModelChange={onModelChange}
        modelRecommendation={modelRecommendation}
        recommendedModelId={recommendedModelId}
        efficientModelId={efficientModelId}
        filteredOut={modelRecommendation?.filteredOut}
      />

      {/* ── Credit cost ── */}
      <span className="whitespace-nowrap text-[11px] tabular-nums text-[#555B6E]">
        {creditCost !== null ? `· ${creditCost} cr` : ''}
      </span>

      <div className="flex-1" />

      {/* ── Generate button ── */}
      <button
        type="button"
        className="flex h-[38px] items-center gap-[7px] rounded-[10px] bg-[linear-gradient(135deg,#6C5CE7_0%,#8B5CF6_100%)] px-5 text-[13px] font-bold tracking-[0.02em] text-white shadow-[0_2px_12px_rgba(108,92,231,0.33),0_0_0_1px_rgba(108,92,231,0.2)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(108,92,231,0.47),0_0_0_1px_rgba(108,92,231,0.33)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_12px_rgba(108,92,231,0.33),0_0_0_1px_rgba(108,92,231,0.2)]"
        onClick={onGenerate}
        disabled={isGenerateDisabled}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {generateLabel}
      </button>
    </footer>
  );
}
