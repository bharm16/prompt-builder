import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@promptstudio/system/components/ui/button';
import { Icon, Play } from '@promptstudio/system/components/ui';
import type { Generation, GenerationsPanelProps } from './types';
import type { DraftModel, GenerationOverrides, KeyframeTile } from '@components/ToolSidebar/types';
import { VIDEO_DRAFT_MODEL } from '@components/ToolSidebar/config/modelConfig';
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
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '../context/GenerationControlsStore';
import { logger } from '@/services/LoggingService';
import { useWorkspaceSession } from '../context/WorkspaceSessionContext';
import { useToast } from '@components/Toast';
import { extractVideoContentAssetId } from '@/utils/storageUrl';

const log = logger.child('GenerationsPanel');
const MAX_KEYFRAMES = 3;

const createKeyframeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const toast = useToast();
  const {
    isSequenceMode,
    isStartingSequence,
    startSequence,
    currentShot,
    generateShot,
    updateShot,
  } = useWorkspaceSession();
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

  const { setControls, faceSwapPreview } = useGenerationControlsContext();
  const { domain } = useGenerationControlsStoreState();
  const { setKeyframes } = useGenerationControlsStoreActions();
  const keyframes = domain.keyframes;
  const cameraMotion = domain.cameraMotion;
  const subjectMotion = domain.subjectMotion;

  const upsertPrimaryKeyframe = useCallback(
    (input: {
      url: string;
      source: KeyframeTile['source'];
      sourcePrompt?: string | null;
      storagePath?: string;
      viewUrlExpiresAt?: string;
      assetId?: string;
    }): void => {
      if (!input.url?.trim()) return;
      const trimmedPrompt = input.sourcePrompt?.trim();
      const existing = keyframes.find((frame) => frame.url === input.url);
      const nextFrame: KeyframeTile = {
        ...(existing ?? { id: createKeyframeId(), url: input.url, source: input.source }),
        url: input.url,
        source: input.source,
        ...(input.assetId ? { assetId: input.assetId } : {}),
        ...(input.storagePath ? { storagePath: input.storagePath } : {}),
        ...(input.viewUrlExpiresAt ? { viewUrlExpiresAt: input.viewUrlExpiresAt } : {}),
        ...(trimmedPrompt ? { sourcePrompt: trimmedPrompt } : {}),
      };
      const nextKeyframes = [
        nextFrame,
        ...keyframes.filter((frame) => frame.id !== nextFrame.id && frame.url !== input.url),
      ].slice(0, MAX_KEYFRAMES);
      setKeyframes(nextKeyframes);
    },
    [keyframes, setKeyframes]
  );

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
    if (
      activeDraftModel === 'flux-kontext' ||
      activeDraftModel === 'wan-2.2' ||
      activeDraftModel === 'wan-2.5'
    ) {
      return activeDraftModel;
    }
    return VIDEO_DRAFT_MODEL.id;
  }, [activeDraftModel]);

  const faceSwapOverride = useMemo<GenerationOverrides | null>(() => {
    if (!faceSwapPreview?.url) return null;
    return {
      startImage: {
        url: faceSwapPreview.url,
        source: 'face-swap',
      },
      characterAssetId: faceSwapPreview.characterAssetId,
      faceSwapAlreadyApplied: true,
      faceSwapUrl: faceSwapPreview.url,
    };
  }, [faceSwapPreview?.characterAssetId, faceSwapPreview?.url]);

  const generateSequenceShot = useCallback(
    async (modelId?: string) => {
      if (!currentShot) return;
      if (currentShot.status === 'generating-keyframe' || currentShot.status === 'generating-video') {
        return;
      }
      if (modelId && currentShot.modelId !== modelId) {
        await updateShot(currentShot.id, { modelId });
      }
      await generateShot(currentShot.id);
    },
    [currentShot, generateShot, updateShot]
  );

  const handleDraft = useCallback(
    (model: DraftModel, overrides?: GenerationOverrides) => {
      if (!prompt.trim()) return;
      if (isSequenceMode) {
        onCreateVersionIfNeeded();
        void generateSequenceShot(model);
        return;
      }
      const resolvedOverrides = overrides ?? faceSwapOverride ?? undefined;
      const versionId = onCreateVersionIfNeeded();
      const primaryKeyframe = keyframes[0];
      const startImage = resolvedOverrides?.startImage ?? (primaryKeyframe
        ? {
            url: primaryKeyframe.url,
            source: primaryKeyframe.source,
            ...(primaryKeyframe.assetId ? { assetId: primaryKeyframe.assetId } : {}),
            ...(primaryKeyframe.storagePath ? { storagePath: primaryKeyframe.storagePath } : {}),
            ...(primaryKeyframe.viewUrlExpiresAt ? { viewUrlExpiresAt: primaryKeyframe.viewUrlExpiresAt } : {}),
          }
        : null);

      generateDraft(model, prompt, {
        promptVersionId: versionId,
        ...(startImage ? { startImage } : {}),
        ...(resolvedOverrides?.characterAssetId ? { characterAssetId: resolvedOverrides.characterAssetId } : {}),
        ...(resolvedOverrides?.faceSwapAlreadyApplied ? { faceSwapAlreadyApplied: true } : {}),
        ...(resolvedOverrides?.faceSwapUrl ? { faceSwapUrl: resolvedOverrides.faceSwapUrl } : {}),
        ...(mergedGenerationParams ? { generationParams: mergedGenerationParams } : {}),
        ...(resolvedOverrides?.generationParams ? { generationParams: resolvedOverrides.generationParams } : {}),
      });
    },
    [
      faceSwapOverride,
      generateDraft,
      generateSequenceShot,
      isSequenceMode,
      keyframes,
      mergedGenerationParams,
      onCreateVersionIfNeeded,
      prompt,
    ]
  );

  const {
    keyframeStep,
    selectedKeyframe,
    handleRender,
    handleApproveKeyframe: approveKeyframeFromWorkflow,
    handleSkipKeyframe,
    handleSelectFrame: selectFrameInWorkflow,
    handleClearSelectedFrame: clearSelectedFrameInWorkflow,
  } = useKeyframeWorkflow({
    prompt,
    keyframes,
    assetReferenceImages,
    detectedCharacter,
    onCreateVersionIfNeeded,
    generateRender,
  });

  const handleApproveKeyframe = useCallback(
    (keyframeUrl: string) => {
      upsertPrimaryKeyframe({
        url: keyframeUrl,
        source: 'generation',
        sourcePrompt: prompt,
      });
      approveKeyframeFromWorkflow(keyframeUrl);
    },
    [approveKeyframeFromWorkflow, prompt, upsertPrimaryKeyframe]
  );

  const handleSelectFrame = useCallback(
    (url: string, frameIndex: number, generationId: string) => {
      const generation = generations.find((item) => item.id === generationId);
      const storagePath = generation?.mediaAssetIds?.[frameIndex];
      upsertPrimaryKeyframe({
        url,
        source: 'generation',
        sourcePrompt: generation?.prompt ?? prompt,
        ...(storagePath ? { storagePath } : {}),
      });
      selectFrameInWorkflow(url, frameIndex, generationId, storagePath);
    },
    [generations, prompt, selectFrameInWorkflow, upsertPrimaryKeyframe]
  );

  const handleClearSelectedFrame = useCallback(() => {
    if (selectedKeyframe) {
      const generation = generations.find((item) => item.id === selectedKeyframe.generationId);
      const storagePath = generation?.mediaAssetIds?.[selectedKeyframe.frameIndex];
      const nextKeyframes = keyframes.filter((frame) => {
        if (frame.url === selectedKeyframe.url) return false;
        if (storagePath && frame.storagePath === storagePath) return false;
        return true;
      });
      if (nextKeyframes.length !== keyframes.length) {
        setKeyframes(nextKeyframes);
      }
    }
    clearSelectedFrameInWorkflow();
  }, [clearSelectedFrameInWorkflow, generations, keyframes, selectedKeyframe, setKeyframes]);

  const handleRenderWithFaceSwap = useCallback(
    (model: string, overrides?: GenerationOverrides) => {
      if (isSequenceMode) {
        onCreateVersionIfNeeded();
        void generateSequenceShot(model);
        return;
      }
      if (!overrides && faceSwapOverride) {
        handleRender(model, faceSwapOverride);
        return;
      }
      handleRender(model, overrides);
    },
    [faceSwapOverride, generateSequenceShot, handleRender, isSequenceMode, onCreateVersionIfNeeded]
  );

  const handleStoryboard = useCallback(() => {
    if (isSequenceMode) return;
    const resolvedPrompt = prompt.trim() || 'Generate a storyboard based on the reference image.';
    const versionId = onCreateVersionIfNeeded();
    const seedImageUrl = keyframes[0]?.url ?? null;
    generateStoryboard(resolvedPrompt, { promptVersionId: versionId, seedImageUrl });
  }, [generateStoryboard, isSequenceMode, keyframes, onCreateVersionIfNeeded, prompt]);

  const handleDelete = useCallback(
    (generation: Generation) => {
      if (isSequenceMode) return;
      removeGeneration(generation.id);
    },
    [isSequenceMode, removeGeneration]
  );

  const handleRetry = useCallback(
    (generation: Generation) => {
      if (isSequenceMode) {
        onCreateVersionIfNeeded();
        void generateSequenceShot(generation.model);
        return;
      }
      retryGeneration(generation.id);
    },
    [generateSequenceShot, isSequenceMode, onCreateVersionIfNeeded, retryGeneration]
  );

  const handleCancel = useCallback(
    (generation: Generation) => {
      if (isSequenceMode) return;
      cancelGeneration(generation.id);
    },
    [cancelGeneration, isSequenceMode]
  );

  const handleDownload = useCallback((generation: Generation) => {
    const url = generation.mediaUrls[0];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleContinueSequence = useCallback(
    async (generation: Generation) => {
      if (isSequenceMode || isStartingSequence) return;
      const mediaUrl = generation.mediaUrls[0] ?? null;
      const sourceVideoId =
        generation.mediaAssetIds?.[0] ?? (mediaUrl ? extractVideoContentAssetId(mediaUrl) : null);
      if (!sourceVideoId) {
        toast.warning('Unable to start a sequence from this generation.');
        return;
      }
      try {
        await startSequence({ sourceVideoId, prompt: generation.prompt });
        toast.success('Sequence mode enabled.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to start sequence');
      }
    },
    [isSequenceMode, isStartingSequence, startSequence, toast]
  );

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
      onRender: handleRenderWithFaceSwap,
      onStoryboard: handleStoryboard,
      isGenerating,
      activeDraftModel,
    }),
    [handleDraft, handleRenderWithFaceSwap, handleStoryboard, isGenerating, activeDraftModel]
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
                onContinueSequence={handleContinueSequence}
                isSequenceMode={isSequenceMode}
                isStartingSequence={isStartingSequence}
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
