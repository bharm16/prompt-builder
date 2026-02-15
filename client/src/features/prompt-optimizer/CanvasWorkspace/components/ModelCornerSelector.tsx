import React from 'react';
import type { ModelRecommendation } from '@/features/model-intelligence/types';
import { ModelRecommendationDropdown } from '@/components/ToolSidebar/components/panels/GenerationControlsPanel/components/ModelRecommendationDropdown';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@/components/ToolSidebar/config/modelConfig';
import { cn } from '@/utils/cn';

interface ModelCornerSelectorProps {
  renderModelOptions: Array<{ id: string; label: string }>;
  renderModelId: string;
  recommendedModelId?: string | undefined;
  efficientModelId?: string | undefined;
  modelRecommendation?: ModelRecommendation | null | undefined;
  onModelChange: (modelId: string) => void;
  className?: string;
}

export function ModelCornerSelector({
  renderModelOptions,
  renderModelId,
  recommendedModelId,
  efficientModelId,
  modelRecommendation,
  onModelChange,
  className,
}: ModelCornerSelectorProps): React.ReactElement {
  const currentModel =
    renderModelId === VIDEO_DRAFT_MODEL.id
      ? VIDEO_DRAFT_MODEL
      : VIDEO_RENDER_MODELS.find((model) => model.id === renderModelId) ?? VIDEO_RENDER_MODELS[0];
  const costLabel = currentModel ? `${currentModel.cost} cr` : null;

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-3 left-3 z-30 inline-flex items-center gap-2 rounded-xl border border-[#22252C] bg-[#0D0E12]/95 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur',
        className
      )}
    >
      <ModelRecommendationDropdown
        renderModelOptions={renderModelOptions}
        renderModelId={renderModelId}
        onModelChange={onModelChange}
        modelRecommendation={modelRecommendation}
        recommendedModelId={recommendedModelId}
        efficientModelId={efficientModelId}
      />
      {costLabel ? (
        <span className="rounded-md border border-[#22252C] bg-[#16181E] px-2 py-1 text-[11px] font-semibold text-[#8B92A5]">
          {costLabel}
        </span>
      ) : null}
    </div>
  );
}
