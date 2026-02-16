import React from 'react';
import type { ModelRecommendation } from '@/features/model-intelligence/types';
import { ModelRecommendationDropdown } from '@/components/ToolSidebar/components/panels/GenerationControlsPanel/components/ModelRecommendationDropdown';
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
  return (
    <div className={cn('absolute z-50', className)} onClick={(e) => e.stopPropagation()}>
      <ModelRecommendationDropdown
        renderModelOptions={renderModelOptions}
        renderModelId={renderModelId}
        onModelChange={onModelChange}
        modelRecommendation={modelRecommendation}
        recommendedModelId={recommendedModelId}
        efficientModelId={efficientModelId}
        triggerPrefixLabel="Model"
        triggerAriaLabel="Video model"
        triggerClassName="inline-flex h-9 items-center gap-[7px] rounded-[10px] border border-[#22252C] bg-[#16181E]/[0.93] px-3.5 text-xs font-semibold text-[#E2E6EF] backdrop-blur-xl"
      />
    </div>
  );
}
