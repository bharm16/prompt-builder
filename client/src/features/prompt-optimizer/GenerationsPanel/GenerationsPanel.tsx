import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@promptstudio/system/components/ui/button';
import { Icon, Play } from '@promptstudio/system/components/ui';
import type { Generation, GenerationsPanelProps } from './types';
import { GenerationCard } from './components/GenerationCard';
import { VersionDivider } from './components/VersionDivider';
import { KeyframeStep } from './components/KeyframeStep';
import { useGenerationsState } from './hooks/useGenerationsState';
import { useGenerationActions } from './hooks/useGenerationActions';
import { useGenerationsTimeline } from './hooks/useGenerationsTimeline';
import { useAssetReferenceImages } from './hooks/useAssetReferenceImages';
import { useGenerationMediaRefresh } from './hooks/useGenerationMediaRefresh';
import { useKeyframeWorkflow } from './hooks/useKeyframeWorkflow';
import { useGenerationControlsContext } from '../context/GenerationControlsContext';
import { logger } from '@/services/LoggingService';

type DraftModel = 'flux-kontext' | 'wan-2.2';
const log = logger.child('GenerationsPanel');

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

export const GenerationsPanel = memo(function GenerationsPanel({
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

  useGenerationMediaRefresh(generations, dispatch);

  const { setControls, keyframes, cameraMotion, subjectMotion } = useGenerationControlsContext();

  const mergedGenerationParams = useMemo(() => {
    const baseParams = { ...(generationParams ?? {}) } as Record<string, unknown>;

    if (keyframes.length > 0) {
      baseParams.keyframes = keyframes;
    }

    if (cameraMotion?.id) {
      baseParams.camera_motion_id = cameraMotion.id;
    }

    const subjectMotionValue = subjectMotion.trim();
    if (subjectMotionValue) {
      baseParams.subject_motion = subjectMotionValue;
    }

    if (Object.keys(baseParams).length === 0) {
      return generationParams;
    }

    return baseParams;
  }, [generationParams, keyframes, cameraMotion?.id, subjectMotion]);

  const motionMergeMeta = useMemo(() => {
    const mergedKeys =
      mergedGenerationParams && typeof mergedGenerationParams === 'object'
        ? Object.keys(mergedGenerationParams as Record<string, unknown>)
        : [];
    const cameraMotionId =
      mergedGenerationParams &&
      typeof mergedGenerationParams === 'object' &&
      typeof (mergedGenerationParams as Record<string, unknown>).camera_motion_id === 'string'
        ? String((mergedGenerationParams as Record<string, unknown>).camera_motion_id)
        : null;
    const subjectMotionLength = subjectMotion.trim().length;

    return {
      keyframesCount: keyframes.length,
      hasCameraMotion: Boolean(cameraMotionId),
      cameraMotionId,
      hasSubjectMotion: subjectMotionLength > 0,
      subjectMotionLength,
      mergedKeysCount: mergedKeys.length,
      mergedKeys,
    } as const;
  }, [mergedGenerationParams, keyframes.length, subjectMotion]);

  useEffect(() => {
    if (!motionMergeMeta.keyframesCount && !motionMergeMeta.hasCameraMotion && !motionMergeMeta.hasSubjectMotion) {
      return;
    }

    log.info('Merged generation params include motion/keyframe context', {
      ...motionMergeMeta,
      hasCameraMotionFieldInMergedParams: motionMergeMeta.mergedKeys.includes('camera_motion_id'),
      hasSubjectMotionFieldInMergedParams: motionMergeMeta.mergedKeys.includes('subject_motion'),
      hasKeyframesFieldInMergedParams: motionMergeMeta.mergedKeys.includes('keyframes'),
    });
  }, [motionMergeMeta]);

  const generationActionsOptions = useMemo(
    () => ({
      aspectRatio,
      duration,
      fps,
      generationParams: mergedGenerationParams,
      promptVersionId,
      generations,
    }),
    [aspectRatio, duration, fps, mergedGenerationParams, promptVersionId, generations]
  );

  const {
    generateDraft,
    generateRender,
    generateStoryboard,
    retryGeneration,
    cancelGeneration,
  } = useGenerationActions(dispatch, generationActionsOptions);

  const { referenceImages: assetReferenceImages, resolvedPrompt } = useAssetReferenceImages(prompt);
  const detectedCharacter = useMemo(
    () => resolvedPrompt?.characters?.[0] ?? null,
    [resolvedPrompt]
  );

  const activeDraftModel = useMemo(
    () => getLatestByTier('draft')?.model ?? null,
    [getLatestByTier]
  );

  const defaultDraftModel: DraftModel = useMemo(() => {
    if (activeDraftModel === 'flux-kontext' || activeDraftModel === 'wan-2.2') {
      return activeDraftModel;
    }
    return 'wan-2.2';
  }, [activeDraftModel]);

  const handleDraft = useCallback(
    (model: DraftModel) => {
      if (!prompt.trim()) return;
      const versionId = onCreateVersionIfNeeded();
      const primaryKeyframe = keyframes[0];
      const startImage = primaryKeyframe
        ? {
            url: primaryKeyframe.url,
            source: primaryKeyframe.source,
            ...(primaryKeyframe.assetId ? { assetId: primaryKeyframe.assetId } : {}),
            ...(primaryKeyframe.storagePath ? { storagePath: primaryKeyframe.storagePath } : {}),
            ...(primaryKeyframe.viewUrlExpiresAt ? { viewUrlExpiresAt: primaryKeyframe.viewUrlExpiresAt } : {}),
          }
        : null;

      generateDraft(model, prompt, {
        promptVersionId: versionId,
        ...(startImage ? { startImage } : {}),
        ...(mergedGenerationParams ? { generationParams: mergedGenerationParams } : {}),
      });
    },
    [generateDraft, keyframes, mergedGenerationParams, onCreateVersionIfNeeded, prompt]
  );

  const {
    keyframeStep,
    selectedKeyframe,
    handleRender,
    handleApproveKeyframe,
    handleSkipKeyframe,
    handleSelectFrame,
    handleClearSelectedFrame,
  } = useKeyframeWorkflow({
    prompt,
    keyframes,
    assetReferenceImages,
    detectedCharacter,
    onCreateVersionIfNeeded,
    generateRender,
  });

  const handleStoryboard = useCallback(() => {
    const resolvedPrompt = prompt.trim() || 'Generate a storyboard based on the reference image.';
    const versionId = onCreateVersionIfNeeded();
    const seedImageUrl = keyframes[0]?.url ?? null;
    generateStoryboard(resolvedPrompt, { promptVersionId: versionId, seedImageUrl });
  }, [generateStoryboard, keyframes, onCreateVersionIfNeeded, prompt]);

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

  const versionsForTimeline = useMemo(() => {
    if (!versions.length || !promptVersionId) return versions;
    const index = versions.findIndex(
      (version) => version.versionId === promptVersionId
    );
    if (index < 0) return versions;
    const target = versions[index];
    if (!target || target.generations === generations) return versions;
    const next = [...versions];
    next[index] = { ...target, generations };
    return next;
  }, [generations, promptVersionId, versions]);

  const timeline = useGenerationsTimeline({ versions: versionsForTimeline });

  const controlsPayload = useMemo(
    () => ({
      onDraft: handleDraft,
      onRender: handleRender,
      onStoryboard: handleStoryboard,
      isGenerating,
      activeDraftModel,
    }),
    [handleDraft, handleRender, handleStoryboard, isGenerating, activeDraftModel]
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
      ) : null}
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
                onSelectFrame={handleSelectFrame}
                onClearSelectedFrame={handleClearSelectedFrame}
                selectedFrameUrl={selectedKeyframe?.url ?? null}
                onClick={() => onRestoreVersion(item.generation._versionId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
});

GenerationsPanel.displayName = 'GenerationsPanel';
