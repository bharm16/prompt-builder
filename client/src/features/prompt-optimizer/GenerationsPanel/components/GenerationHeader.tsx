import React, { useEffect, useState } from 'react';
import { DRAFT_MODELS, RENDER_MODELS } from '../config/generationConfig';
import { SplitActionButton } from './SplitActionButton';

interface GenerationHeaderProps {
  onDraft: (model: 'flux-kontext' | 'wan-2.2') => void;
  onRender: (model: string) => void;
  isDraftDisabled?: boolean;
  isRenderDisabled?: boolean;
  activeDraftModel?: string | null;
}

export function GenerationHeader({
  onDraft,
  onRender,
  isDraftDisabled = false,
  isRenderDisabled = false,
  activeDraftModel,
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
        <SplitActionButton
          label="Render"
          selectedModel={renderModel}
          models={RENDER_MODELS}
          onRun={() => onRender(renderModel)}
          onModelChange={setRenderModel}
          disabled={isRenderDisabled}
          variant="accent"
        />
      </div>
    </div>
  );
}
