import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Trash2, Wand2, X } from '@promptstudio/system/components/ui';
import { VIDEO_DRAFT_MODEL } from '@components/ToolSidebar/config/modelConfig';
import { GenerationFooter } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter';
import { VideoSettingsRow } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/components/VideoSettingsRow';
import { useCapabilitiesClamping } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping';
import { useModelSelectionRecommendation } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation';
import type { VideoTier } from '@components/ToolSidebar/types';
import { useOptionalPromptHighlights } from '@/features/prompt-optimizer/context/PromptStateContext';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useClipboard } from '@/features/prompt-optimizer/hooks/useClipboard';
import { useWorkspaceSession } from '@/features/prompt-optimizer/context/WorkspaceSessionContext';
import type { SessionContinuityMode } from '@shared/types/session';
import { ContinuityIntentPicker } from './ContinuityIntentPicker';
import { PipelineStatus } from './PipelineStatus';
import { PreviousShotContext } from './PreviousShotContext';
import { ShotVisualStrip } from './ShotVisualStrip';

interface SequenceWorkspaceProps {
  promptText: string;
  onPromptChange?: (text: string) => void;
  isOptimizing: boolean;
  onAiEnhance: () => void;
  onAddShot: () => void;
  onExitSequence?: () => void;
}

const parseDuration = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 5;
};

const parseAspectRatio = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '16:9';
};

export function SequenceWorkspace({
  promptText,
  onPromptChange,
  isOptimizing,
  onAiEnhance,
  onAddShot,
  onExitSequence,
}: SequenceWorkspaceProps): React.ReactElement {
  const [isGenerating, setIsGenerating] = useState(false);
  const { copy } = useClipboard();

  const {
    session,
    shots,
    currentShotId,
    currentShot,
    currentShotIndex,
    setCurrentShotId,
    updateShot,
    generateShot,
  } = useWorkspaceSession();

  const { domain } = useGenerationControlsStoreState();
  const { setSelectedModel, setVideoTier, mergeGenerationParams } = useGenerationControlsStoreActions();
  const promptHighlights = useOptionalPromptHighlights();

  const selectedModel = domain.selectedModel;
  const tier = domain.videoTier;
  const keyframes = domain.keyframes;
  const aspectRatio = parseAspectRatio(domain.generationParams?.aspect_ratio);
  const duration = parseDuration(domain.generationParams?.duration_s);

  const orderedShots = useMemo(
    () => [...shots].sort((a, b) => a.sequenceIndex - b.sequenceIndex),
    [shots]
  );

  const previousShot = useMemo(
    () => (currentShotIndex > 0 ? orderedShots[currentShotIndex - 1] ?? null : null),
    [currentShotIndex, orderedShots]
  );

  const {
    modelRecommendation,
    recommendedModelId,
    efficientModelId,
    renderModelOptions,
    renderModelId,
  } = useModelSelectionRecommendation({
    prompt: promptText,
    activeTab: 'video',
    keyframesCount: keyframes.length,
    durationSeconds: duration,
    selectedModel,
    videoTier: tier,
    promptHighlights: promptHighlights?.initialHighlights ?? null,
  });

  const handleAspectRatioChange = useCallback(
    (ratio: string): void => {
      if (domain.generationParams?.aspect_ratio === ratio) return;
      mergeGenerationParams({ aspect_ratio: ratio });
    },
    [domain.generationParams?.aspect_ratio, mergeGenerationParams]
  );

  const handleDurationChange = useCallback(
    (nextDuration: number): void => {
      if (domain.generationParams?.duration_s === nextDuration) return;
      mergeGenerationParams({ duration_s: nextDuration });
    },
    [domain.generationParams?.duration_s, mergeGenerationParams]
  );

  const { aspectRatioInfo, durationInfo, aspectRatioOptions, durationOptions } = useCapabilitiesClamping({
    activeTab: 'video',
    selectedModel,
    videoTier: tier,
    renderModelId,
    aspectRatio,
    duration,
    setVideoTier,
    onAspectRatioChange: handleAspectRatioChange,
    onDurationChange: handleDurationChange,
  });

  const handleModeChange = useCallback(
    (mode: SessionContinuityMode): void => {
      if (!currentShot) return;
      void updateShot(currentShot.id, { continuityMode: mode });
    },
    [currentShot, updateShot]
  );

  const handleStrengthChange = useCallback(
    (strength: number): void => {
      if (!currentShot) return;
      void updateShot(currentShot.id, { styleStrength: strength });
    },
    [currentShot, updateShot]
  );

  const handleModelChange = useCallback(
    (modelId: string): void => {
      const nextTier: VideoTier = modelId === VIDEO_DRAFT_MODEL.id ? 'draft' : 'render';
      setSelectedModel(modelId);
      if (tier !== nextTier) {
        setVideoTier(nextTier);
      }
      if (currentShot && currentShot.modelId !== modelId) {
        void updateShot(currentShot.id, { modelId });
      }
    },
    [currentShot, setSelectedModel, setVideoTier, tier, updateShot]
  );

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!currentShot || isGenerating) return;
    setIsGenerating(true);
    try {
      await generateShot(currentShot.id);
    } finally {
      setIsGenerating(false);
    }
  }, [currentShot, generateShot, isGenerating]);

  const handleCopyPrompt = useCallback(async (): Promise<void> => {
    if (!promptText.trim()) return;
    await copy(promptText);
  }, [copy, promptText]);

  const handleClearPrompt = useCallback((): void => {
    onPromptChange?.('');
  }, [onPromptChange]);

  const isGenerateDisabled =
    !currentShot ||
    !promptText.trim() ||
    isGenerating ||
    currentShot.status === 'generating-keyframe' ||
    currentShot.status === 'generating-video';

  const generateLabel = currentShotIndex >= 0 ? `Generate Shot ${currentShotIndex + 1}` : 'Generate';

  return (
    <main id="main-content" className="flex h-full min-h-0 flex-col bg-[#111318]">
      <header className="flex h-12 items-center border-b border-border px-3">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Sequence
        </span>
        <span className="ml-2 flex-1 truncate text-sm text-foreground">{session?.name || 'Untitled session'}</span>
        {onExitSequence && (
          <button
            type="button"
            onClick={onExitSequence}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-muted transition-colors hover:bg-surface-1 hover:text-foreground"
            aria-label="Exit sequence"
          >
            <X className="h-3.5 w-3.5" />
            Exit
          </button>
        )}
      </header>

      <ShotVisualStrip
        shots={orderedShots}
        currentShotId={currentShotId}
        onShotSelect={setCurrentShotId}
        onAddShot={onAddShot}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {previousShot && currentShot && currentShotIndex > 0 && (
            <PreviousShotContext previousShot={previousShot} continuityMode={currentShot.continuityMode} />
          )}

          {currentShot && currentShotIndex > 0 && (
            <ContinuityIntentPicker
              mode={currentShot.continuityMode}
              onModeChange={handleModeChange}
              strength={currentShot.styleStrength ?? 0.6}
              onStrengthChange={handleStrengthChange}
            />
          )}

          <section className="overflow-hidden rounded-xl border border-border bg-surface-2">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {currentShotIndex >= 0 ? `Shot ${currentShotIndex + 1} prompt` : 'Shot prompt'}
              </span>
              <span className="text-[10px] tabular-nums text-muted">{promptText.length} chars</span>
            </div>

            <div className="px-3 py-2">
              <textarea
                value={promptText}
                onChange={(event) => onPromptChange?.(event.target.value)}
                readOnly={!onPromptChange}
                placeholder="Describe your shot..."
                rows={6}
                className="min-h-[132px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-foreground outline-none"
                aria-label="Shot prompt"
              />
            </div>

            <div className="flex h-10 items-center gap-1 border-t border-border px-2">
              <button
                type="button"
                onClick={() => void handleCopyPrompt()}
                disabled={!promptText.trim()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-1 hover:text-foreground disabled:opacity-50"
                aria-label="Copy prompt"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClearPrompt}
                disabled={!onPromptChange || !promptText.length}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-1 hover:text-foreground disabled:opacity-50"
                aria-label="Clear prompt"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={onAiEnhance}
                disabled={isOptimizing || !promptText.trim()}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                AI Enhance
              </button>
            </div>
          </section>

          <PipelineStatus shot={currentShot} isGenerating={isGenerating} />
        </div>
      </div>

      <VideoSettingsRow
        aspectRatio={aspectRatio}
        duration={duration}
        aspectRatioOptions={aspectRatioOptions}
        durationOptions={durationOptions}
        onAspectRatioChange={handleAspectRatioChange}
        onDurationChange={handleDurationChange}
        isAspectRatioDisabled={aspectRatioInfo?.state.disabled}
        isDurationDisabled={durationInfo?.state.disabled}
        isMotionDisabled
      />

      <GenerationFooter
        renderModelOptions={renderModelOptions}
        renderModelId={renderModelId}
        onModelChange={handleModelChange}
        onGenerate={() => void handleGenerate()}
        isGenerateDisabled={isGenerateDisabled}
        generateLabel={generateLabel}
        modelRecommendation={modelRecommendation}
        recommendedModelId={recommendedModelId}
        efficientModelId={efficientModelId}
      />
    </main>
  );
}

export default SequenceWorkspace;
