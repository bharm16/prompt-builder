import React, { useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@promptstudio/system/components/ui/button';
import { Icon, Play } from '@promptstudio/system/components/ui';
import type { Asset } from '@shared/types/asset';
import type { Generation, GenerationsPanelProps } from './types';
import { GenerationCard } from './components/GenerationCard';
import { VersionDivider } from './components/VersionDivider';
import { KeyframeSelector, type SelectedKeyframe } from './components/KeyframeSelector';
import { KeyframeStep } from './components/KeyframeStep';
import { useGenerationsState } from './hooks/useGenerationsState';
import { useGenerationActions } from './hooks/useGenerationActions';
import { useGenerationsTimeline } from './hooks/useGenerationsTimeline';
import { useAssetReferenceImages } from './hooks/useAssetReferenceImages';
import { useGenerationControlsContext } from '../context/GenerationControlsContext';

type DraftModel = 'flux-kontext' | 'wan-2.2';
type StartImageOverride = {
  url: string;
  assetId?: string;
  source: 'preview' | 'upload' | 'asset' | 'library' | 'keyframe';
};

const EmptyState = ({
  onRunDraft,
  isRunDraftDisabled,
}: {
  onRunDraft: () => void;
  isRunDraftDisabled: boolean;
}): React.ReactElement => (
  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
    <div className="border-border aspect-video flex w-full max-w-sm flex-col items-center justify-center rounded-lg border border-dashed p-6">
      <Icon
        icon={Play}
        size="xl"
        className="text-muted mb-4"
        aria-hidden="true"
      />
      <div className="text-base font-medium text-foreground mb-3">
        No outputs yet
      </div>
      <div className="text-sm text-muted">
        Run a draft or render to see your outputs here.
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4 h-8 px-3 rounded-md text-sm font-semibold tracking-[0.14px] border-[#2C3037] text-[#A1AFC5] shadow-none"
        onClick={onRunDraft}
        disabled={isRunDraftDisabled}
      >
        Run Draft
      </Button>
    </div>
  </div>
);

export function GenerationsPanel({
  prompt,
  promptVersionId,
  aspectRatio,
  duration,
  fps,
  generationParams,
  initialGenerations,
  onGenerationsChange,
  className,
  versions,
  onRestoreVersion,
  onCreateVersionIfNeeded,
}: GenerationsPanelProps): React.ReactElement {
  const {
    generations,
    activeGenerationId,
    isGenerating,
    dispatch,
    getLatestByTier,
    removeGeneration,
  } = useGenerationsState({
    initialGenerations,
    onGenerationsChange,
    promptVersionId,
  });

  const generationActionsOptions = useMemo(
    () => ({
      aspectRatio,
      duration,
      fps,
      generationParams,
      promptVersionId,
      generations,
    }),
    [aspectRatio, duration, fps, generationParams, promptVersionId, generations]
  );

  const { generateDraft, generateRender, retryGeneration, cancelGeneration } =
    useGenerationActions(dispatch, generationActionsOptions);

  const [selectedKeyframe, setSelectedKeyframe] = React.useState<SelectedKeyframe | null>(
    null
  );

  const [keyframeStep, setKeyframeStep] = React.useState<{
    isActive: boolean;
    character: Asset | null;
    approvedKeyframeUrl: string | null;
    pendingModel: string | null;
  }>({
    isActive: false,
    character: null,
    approvedKeyframeUrl: null,
    pendingModel: null,
  });

  const { referenceImages: assetReferenceImages, resolvedPrompt } = useAssetReferenceImages(prompt);
  const { setControls, startImage } = useGenerationControlsContext();
  const detectedCharacter = useMemo(
    () => resolvedPrompt?.characters?.[0] ?? null,
    [resolvedPrompt]
  );

  React.useEffect(() => {
    setKeyframeStep({
      isActive: false,
      character: null,
      approvedKeyframeUrl: null,
      pendingModel: null,
    });
  }, [prompt]);

  const activeDraftModel = useMemo(
    () => getLatestByTier('draft')?.model ?? null,
    [getLatestByTier]
  );

  const defaultDraftModel: DraftModel = useMemo(() => {
    if (activeDraftModel === 'flux-kontext' || activeDraftModel === 'wan-2.2') {
      return activeDraftModel;
    }
    return 'flux-kontext';
  }, [activeDraftModel]);

  const handleDraft = useCallback(
    (model: DraftModel) => {
      if (!prompt.trim()) return;
      const versionId = onCreateVersionIfNeeded();
      generateDraft(model, prompt, { promptVersionId: versionId });
    },
    [generateDraft, onCreateVersionIfNeeded, prompt]
  );

  const runRender = useCallback(
    (model: string, startImageOverride?: StartImageOverride | null) => {
      if (!prompt.trim()) return;
      const versionId = onCreateVersionIfNeeded();
      let startImage = null;
      if (startImageOverride) {
        startImage = {
          url: startImageOverride.url,
          source: startImageOverride.source,
          ...(startImageOverride.assetId ? { assetId: startImageOverride.assetId } : {}),
        };
      } else if (selectedKeyframe) {
        startImage = {
          url: selectedKeyframe.url,
          source: selectedKeyframe.source,
        };
      } else if (assetReferenceImages.length > 0) {
        const characterReference = assetReferenceImages.find(
          (reference) => reference.assetType === 'character'
        );
        if (characterReference) {
          startImage = {
            url: characterReference.imageUrl,
            assetId: characterReference.assetId,
            source: 'asset' as const,
          };
        }
      }

      generateRender(model, prompt, {
        promptVersionId: versionId,
        startImage,
      });
      setSelectedKeyframe(null);
      setKeyframeStep({
        isActive: false,
        character: null,
        approvedKeyframeUrl: null,
        pendingModel: null,
      });
    },
    [
      assetReferenceImages,
      generateRender,
      onCreateVersionIfNeeded,
      prompt,
      selectedKeyframe,
    ]
  );

  const handleRender = useCallback(
    (model: string) => {
      if (!prompt.trim()) return;
      if (startImage) {
        runRender(model, {
          url: startImage.url,
          source: startImage.source as StartImageOverride['source'],
          ...(startImage.assetId ? { assetId: startImage.assetId } : {}),
        });
        return;
      }
      if (keyframeStep.isActive) {
        setKeyframeStep((prev) => ({ ...prev, pendingModel: model }));
        return;
      }
      if (detectedCharacter) {
        setKeyframeStep({
          isActive: true,
          character: detectedCharacter,
          approvedKeyframeUrl: null,
          pendingModel: model,
        });
        return;
      }

      runRender(model, null);
    },
    [
      detectedCharacter,
      keyframeStep.isActive,
      prompt,
      runRender,
      startImage,
    ]
  );

  const handleApproveKeyframe = useCallback(
    (keyframeUrl: string) => {
      const modelToUse = keyframeStep.pendingModel ?? 'sora';
      runRender(modelToUse, { url: keyframeUrl, source: 'keyframe' });
    },
    [keyframeStep.pendingModel, runRender]
  );

  const handleSkipKeyframe = useCallback(() => {
    const modelToUse = keyframeStep.pendingModel ?? 'sora';
    runRender(modelToUse, null);
  }, [keyframeStep.pendingModel, runRender]);

  const handleDelete = useCallback(
    (generation: Generation) => {
      removeGeneration(generation.id);
    },
    [removeGeneration]
  );

  const handleRetry = useCallback(
    (generation: Generation) => {
      retryGeneration(generation.id);
    },
    [retryGeneration]
  );

  const handleCancel = useCallback(
    (generation: Generation) => {
      cancelGeneration(generation.id);
    },
    [cancelGeneration]
  );

  const handleDownload = useCallback((generation: Generation) => {
    const url = generation.mediaUrls[0];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleUseAsKeyframe = useCallback((generation: Generation) => {
    const url = generation.mediaUrls[0];
    if (url) {
      setSelectedKeyframe({ url, generationId: generation.id, source: 'preview' });
    }
  }, []);

  const versionsForTimeline = useMemo(() => {
    if (!versions.length || !promptVersionId) return versions;
    const index = versions.findIndex(
      (version) => version.versionId === promptVersionId
    );
    if (index < 0) return versions;
    const target = versions[index];
    if (target?.generations === generations) return versions;
    const next = [...versions];
    next[index] = { ...target, generations };
    return next;
  }, [generations, promptVersionId, versions]);

  const timeline = useGenerationsTimeline({ versions: versionsForTimeline });

  const controlsPayload = useMemo(
    () => ({
      onDraft: handleDraft,
      onRender: handleRender,
      isGenerating,
      activeDraftModel,
    }),
    [handleDraft, handleRender, isGenerating, activeDraftModel]
  );

  useEffect(() => {
    setControls(controlsPayload);
    return () => setControls(null);
  }, [controlsPayload, setControls]);

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      {keyframeStep.isActive && keyframeStep.character ? (
        <KeyframeStep
          prompt={prompt}
          character={keyframeStep.character}
          aspectRatio={aspectRatio}
          onApprove={handleApproveKeyframe}
          onSkip={handleSkipKeyframe}
        />
      ) : (
        <div className="border-b border-border px-4 py-3">
          <KeyframeSelector
            generations={generations}
            selectedKeyframe={selectedKeyframe}
            onSelect={setSelectedKeyframe}
            onClear={() => setSelectedKeyframe(null)}
          />
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {timeline.length === 0 ? (
          <EmptyState
            onRunDraft={() => handleDraft(defaultDraftModel)}
            isRunDraftDisabled={!prompt.trim() || isGenerating}
          />
        ) : (
          timeline.map((item, index) => {
            if (item.type === 'divider') {
              return (
                <VersionDivider
                  key={`divider-${item.versionId}-${index}`}
                  versionLabel={item.versionLabel}
                  promptChanged={item.promptChanged}
                />
              );
            }

            return (
              <GenerationCard
                key={item.generation.id}
                generation={item.generation}
                isActive={item.generation.id === activeGenerationId}
                onRetry={handleRetry}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onCancel={handleCancel}
                onUseAsKeyframe={handleUseAsKeyframe}
                onClick={() => onRestoreVersion(item.generation._versionId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
