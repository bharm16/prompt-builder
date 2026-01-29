import React from 'react';
import { Images, Info } from '@promptstudio/system/components/ui';
import {
  ModelSelector,
} from '@/features/model-intelligence';
import { VIDEO_DRAFT_MODEL } from '@components/ToolSidebar/config/modelConfig';
import type { VideoTier } from '@components/ToolSidebar/types';

interface ModelOption {
  id: string;
  label: string;
}

interface GenerationFooterProps {
  tier: VideoTier;
  renderModelOptions: ModelOption[];
  renderModelId: string;
  recommendedModelId?: string;
  efficientModelId?: string;
  onModelChange: (model: string) => void;
  optimizationActions: React.ReactNode;
  onStoryboard: () => void;
  isStoryboardDisabled: boolean;
  onGenerate: () => void;
  isGenerateDisabled: boolean;
}

export function GenerationFooter({
  tier,
  renderModelOptions,
  renderModelId,
  recommendedModelId,
  efficientModelId,
  onModelChange,
  optimizationActions,
  onStoryboard,
  isStoryboardDisabled,
  onGenerate,
  isGenerateDisabled,
}: GenerationFooterProps): React.ReactElement {
  return (
    <footer className="h-[73px] px-4 py-3 flex items-center justify-between border-t border-[#29292D]">
      <div className="flex items-center gap-2">
        {tier === 'draft' ? (
          <div className="h-10 rounded-lg px-3 bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm font-semibold flex items-center gap-2">
            <span>{VIDEO_DRAFT_MODEL.label}</span>
          </div>
        ) : (
          <ModelSelector
            options={renderModelOptions}
            selectedModel={renderModelId}
            recommendedId={recommendedModelId}
            efficientId={efficientModelId}
            onChange={onModelChange}
            label={null}
            ariaLabel="Render model"
            className="min-w-[180px]"
            selectClassName="h-10 px-3 rounded-lg bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm font-semibold"
          />
        )}
        <button
          type="button"
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#A1AFC5] hover:bg-[#1B1E23]"
          aria-label="Info"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {optimizationActions}
        <button
          type="button"
          className="h-10 px-3 rounded-lg border border-[#29292D] text-[#A1AFC5] text-sm font-semibold hover:bg-[#1B1E23] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onStoryboard}
          disabled={isStoryboardDisabled}
        >
          <span className="flex items-center gap-1">
            <Images className="w-4 h-4" />
            Storyboard
          </span>
        </button>
        <button
          type="button"
          className="h-8 px-[10px] py-[4px] bg-[#2C22FA] text-white rounded-[4px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onGenerate}
          disabled={isGenerateDisabled}
        >
          Generate
        </button>
      </div>
    </footer>
  );
}
