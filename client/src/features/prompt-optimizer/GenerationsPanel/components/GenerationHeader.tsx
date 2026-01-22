import React, { useEffect, useState } from 'react';
import { X } from '@promptstudio/system/components/ui';
import { DRAFT_MODELS, RENDER_MODELS } from '../config/generationConfig';
import { SplitActionButton } from './SplitActionButton';
import type { SelectedKeyframe } from './KeyframeSelector';

const I2V_SUPPORTED_MODELS = new Set([
  'sora-2',
  'sora-2-pro',
  'luma-ray3',
  'kling-v2-1-master',
  'wan-2.2',
]);

type AssetReferenceImage = {
  assetId: string;
  assetType: string;
  assetName?: string;
  imageUrl: string;
};

interface GenerationHeaderProps {
  onDraft: (model: 'flux-kontext' | 'wan-2.2') => void;
  onRender: (model: string) => void;
  isDraftDisabled?: boolean;
  isRenderDisabled?: boolean;
  activeDraftModel?: string | null;
  selectedKeyframe?: SelectedKeyframe | null;
  onClearKeyframe?: () => void;
  assetReferenceImages?: AssetReferenceImage[];
}

export function GenerationHeader({
  onDraft,
  onRender,
  isDraftDisabled = false,
  isRenderDisabled = false,
  activeDraftModel,
  selectedKeyframe,
  onClearKeyframe,
  assetReferenceImages,
}: GenerationHeaderProps): React.ReactElement {
  const [draftModel, setDraftModel] = useState<string>(
    activeDraftModel ?? 'flux-kontext'
  );
  const [renderModel, setRenderModel] = useState<string>('sora');

  useEffect(() => {
    if (activeDraftModel) {
      setDraftModel(activeDraftModel);
    }
  }, [activeDraftModel]);

  return (
    <div className="flex h-ps-9 items-center gap-ps-3 overflow-x-auto px-ps-6">
      <div className="flex items-center gap-2">
        <SplitActionButton
          label="Draft"
          selectedModel={draftModel}
          models={DRAFT_MODELS}
          onRun={() => onDraft(draftModel as 'flux-kontext' | 'wan-2.2')}
          onModelChange={setDraftModel}
          disabled={isDraftDisabled}
          variant="default"
        />
        {selectedKeyframe && (
          <div className="flex items-center gap-2 rounded-md bg-accent/10 px-2 py-1">
            <img
              src={selectedKeyframe.url}
              alt="Keyframe"
              className="h-6 w-10 rounded object-cover"
            />
            <span className="text-label-sm text-accent">Keyframe set</span>
            {onClearKeyframe && (
              <button
                type="button"
                onClick={onClearKeyframe}
                className="text-muted hover:text-foreground"
                aria-label="Clear keyframe"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {!selectedKeyframe &&
          assetReferenceImages &&
          assetReferenceImages.length > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-violet-500/10 px-2 py-1">
              <img
                src={assetReferenceImages[0].imageUrl}
                alt={assetReferenceImages[0].assetName || 'Reference'}
                className="h-6 w-10 rounded object-cover"
              />
              <span className="text-label-sm text-violet-400">
                {assetReferenceImages[0].assetName
                  ? `@${assetReferenceImages[0].assetName} reference`
                  : 'Reference image'}
              </span>
            </div>
          )}
        <SplitActionButton
          label="Render"
          selectedModel={renderModel}
          models={RENDER_MODELS}
          onRun={() => onRender(renderModel)}
          onModelChange={setRenderModel}
          disabled={isRenderDisabled}
          variant="accent"
          renderItemSuffix={(id) =>
            I2V_SUPPORTED_MODELS.has(id) ? (
              <span className="ml-auto rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                i2v
              </span>
            ) : null
          }
        />
      </div>
    </div>
  );
}
