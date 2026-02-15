import React from 'react';
import { ChevronDown } from '@promptstudio/system/components/ui';
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
      : VIDEO_RENDER_MODELS.find((m) => m.id === renderModelId) ?? VIDEO_RENDER_MODELS[0];

  return (
    <div
      className={cn('absolute z-50', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="inline-flex h-9 items-center gap-[7px] rounded-[10px] border border-[#22252C] bg-[#16181E]/[0.93] px-3.5 backdrop-blur-xl">
        <span className="text-[11px] font-medium text-[#555B6E]">Model</span>
        <ModelRecommendationDropdown
          renderModelOptions={renderModelOptions}
          renderModelId={renderModelId}
          onModelChange={onModelChange}
          modelRecommendation={modelRecommendation}
          recommendedModelId={recommendedModelId}
          efficientModelId={efficientModelId}
        />
        <span className="flex text-[#555B6E]">
          <ChevronDown size={10} />
        </span>
      </div>
    </div>
  );
}
