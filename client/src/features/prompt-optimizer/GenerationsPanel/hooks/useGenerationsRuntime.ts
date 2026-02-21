import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { DraftModel, GenerationOverrides } from '@components/ToolSidebar/types';
import { useCreditBalance } from '@/contexts/CreditBalanceContext';
import { useAuthUser } from '@hooks/useAuthUser';
import { useToast } from '@components/Toast';
import { logger } from '@/services/LoggingService';
import { usePromptNavigation, usePromptSession } from '../../context/PromptStateContext';
import { useWorkspaceSession } from '../../context/WorkspaceSessionContext';
import { useGenerationControlsContext } from '../../context/GenerationControlsContext';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '../../context/GenerationControlsStore';
import { resolvePrimaryVideoSource } from '../utils/videoSource';
import { getModelConfig } from '../config/generationConfig';
import { useGenerationsState } from './useGenerationsState';
import { useGenerationActions } from './useGenerationActions';
import { useAssetReferenceImages } from './useAssetReferenceImages';
import { useGenerationMediaRefresh } from './useGenerationMediaRefresh';
import { useKeyframeWorkflow } from './useKeyframeWorkflow';
import { useGenerationsTimeline } from './useGenerationsTimeline';
import { VIDEO_DRAFT_MODEL } from '@/components/ToolSidebar/config/modelConfig';
import type {
  Generation,
  GenerationsPanelProps,
  GenerationsPanelRuntime,
  GenerationsPanelStateSnapshot,
} from '../types';

const log = logger.child('useGenerationsRuntime');

interface UseGenerationsRuntimeOptions {
  prompt: string;
  promptVersionId: string;
  aspectRatio: string;
  duration?: number | undefined;
  fps?: number | undefined;
  generationParams?: Record<string, unknown> | undefined;
  initialGenerations?: Generation[] | undefined;
  onGenerationsChange?: ((generations: Generation[]) => void) | undefined;
  presentation?: 'timeline' | 'hero' | undefined;
  onStateSnapshot?: ((snapshot: GenerationsPanelStateSnapshot) => void) | undefined;
  versions: GenerationsPanelProps['versions'];
  onCreateVersionIfNeeded: () => string;
  heroOverrideGenerationId?: string | null | undefined;
}

export function useGenerationsRuntime({
  prompt,
  promptVersionId,
  aspectRatio,
  duration,
  fps,
  generationParams,
  initialGenerations,
  onGenerationsChange,
  presentation = 'timeline',
  onStateSnapshot,
  versions,
  onCreateVersionIfNeeded,
  heroOverrideGenerationId,
}: UseGenerationsRuntimeOptions): GenerationsPanelRuntime {
  const toast = useToast();
  const authUser = useAuthUser();
  const { balance } = useCreditBalance();
  const { navigate, sessionId: currentSessionId } = usePromptNavigation();
  const { currentPromptDocId } = usePromptSession();
  const {
    session: workspaceSession,
    isSequenceMode,
    hasActiveContinuityShot,
    isStartingSequence,
    startSequence,
    currentShot,
    generateShot,
    updateShot,
  } = useWorkspaceSession();
  const currentRouteSessionIdRef = useRef<string | null>(currentSessionId ?? null);
  useEffect(() => {
    currentRouteSessionIdRef.current = currentSessionId ?? null;
  }, [currentSessionId]);

  const {
    generations,
    activeGenerationId,
    isGenerating,
    dispatch,
    getLatestByTier,
    removeGeneration,
    setActiveGeneration,
  } = useGenerationsState({
    initialGenerations,
    onGenerationsChange,
    promptVersionId,
  });

  useGenerationMediaRefresh(generations, dispatch);

  const { setControls, faceSwapPreview, onInsufficientCredits } =
    useGenerationControlsContext();
  const onInsufficientCreditsRef = useRef(onInsufficientCredits);
  onInsufficientCreditsRef.current = onInsufficientCredits;
  const notifyInsufficientCredits = useCallback(
    (required: number, operation: string) => {
      onInsufficientCreditsRef.current?.(required, operation);
    },
    []
  );
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const authUidRef = useRef(authUser?.uid);
  authUidRef.current = authUser?.uid;
  const { domain } = useGenerationControlsStoreState();
  const { setStartFrame, clearStartFrame } = useGenerationControlsStoreActions();
  const keyframes = domain.keyframes;
  const startFrame = domain.startFrame;
  const cameraMotion = domain.cameraMotion;
  const subjectMotion = domain.subjectMotion;

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
  }, [cameraMotion?.id, generationParams, keyframes, subjectMotion]);

  const motionMergeMeta = useMemo(() => {
    const mergedKeys =
      mergedGenerationParams && typeof mergedGenerationParams === 'object'
        ? Object.keys(mergedGenerationParams as Record<string, unknown>)
        : [];
    const cameraMotionId =
      mergedGenerationParams &&
      typeof mergedGenerationParams === 'object' &&
      typeof (mergedGenerationParams as Record<string, unknown>).camera_motion_id ===
        'string'
        ? String(
            (mergedGenerationParams as Record<string, unknown>).camera_motion_id
          )
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
  }, [keyframes.length, mergedGenerationParams, subjectMotion]);

  useEffect(() => {
    if (
      !motionMergeMeta.keyframesCount &&
      !motionMergeMeta.hasCameraMotion &&
      !motionMergeMeta.hasSubjectMotion
    ) {
      return;
    }

    log.info('Merged generation params include motion/keyframe context', {
      ...motionMergeMeta,
      hasCameraMotionFieldInMergedParams:
        motionMergeMeta.mergedKeys.includes('camera_motion_id'),
      hasSubjectMotionFieldInMergedParams:
        motionMergeMeta.mergedKeys.includes('subject_motion'),
      hasKeyframesFieldInMergedParams:
        motionMergeMeta.mergedKeys.includes('keyframes'),
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
      onInsufficientCredits: notifyInsufficientCredits,
    }),
    [
      aspectRatio,
      duration,
      fps,
      generations,
      mergedGenerationParams,
      notifyInsufficientCredits,
      promptVersionId,
    ]
  );

  const {
    generateDraft,
    generateRender,
    generateStoryboard,
    retryGeneration,
    cancelGeneration,
  } = useGenerationActions(dispatch, generationActionsOptions);

  const { resolvedPrompt } = useAssetReferenceImages(prompt);
  const detectedCharacter = useMemo(
    () => resolvedPrompt?.characters?.[0] ?? null,
    [resolvedPrompt]
  );

  const activeDraftModel = useMemo(
    () => getLatestByTier('draft')?.model ?? null,
    [getLatestByTier]
  );

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

  const hasCreditsFor = useCallback(
    (required: number, operation: string): boolean => {
      if (!authUidRef.current) return true;
      if (balanceRef.current === null || balanceRef.current === undefined) return true;
      if (balanceRef.current >= required) return true;
      onInsufficientCreditsRef.current?.(required, operation);
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- balance/authUid accessed via stable refs
    []
  );

  const generateSequenceShot = useCallback(
    async (modelId?: string) => {
      if (!currentShot) {
        toast.warning('No active continuity shot available.');
        return;
      }
      if (
        currentShot.status === 'generating-keyframe' ||
        currentShot.status === 'generating-video'
      ) {
        toast.warning('A shot is already generating.');
        return;
      }
      if (modelId && currentShot.modelId !== modelId) {
        await updateShot(currentShot.id, { modelId });
      }
      await generateShot(currentShot.id);
    },
    [currentShot, generateShot, toast, updateShot]
  );

  const handleDraft = useCallback(
    (model: DraftModel, overrides?: GenerationOverrides) => {
      if (!prompt.trim()) return;
      if (hasActiveContinuityShot) {
        onCreateVersionIfNeeded();
        void generateSequenceShot(model);
        return;
      }
      const modelConfig = getModelConfig(model);
      const requiredCredits = modelConfig?.credits ?? 0;
      const operationLabel = `${modelConfig?.label ?? 'Video'} preview`;
      if (!hasCreditsFor(requiredCredits, operationLabel)) {
        return;
      }
      const resolvedOverrides = overrides ?? faceSwapOverride ?? undefined;
      const versionId = onCreateVersionIfNeeded();
      const resolvedStartImage =
        resolvedOverrides?.startImage ??
        (startFrame
          ? {
              url: startFrame.url,
              source: startFrame.source,
              ...(startFrame.assetId ? { assetId: startFrame.assetId } : {}),
              ...(startFrame.storagePath
                ? { storagePath: startFrame.storagePath }
                : {}),
              ...(startFrame.viewUrlExpiresAt
                ? { viewUrlExpiresAt: startFrame.viewUrlExpiresAt }
                : {}),
            }
          : null);
      const autoCharacterAssetId =
        resolvedOverrides?.characterAssetId ??
        (!resolvedStartImage ? detectedCharacter?.id : undefined);

      generateDraft(model, prompt, {
        promptVersionId: versionId,
        ...(resolvedStartImage ? { startImage: resolvedStartImage } : {}),
        ...(autoCharacterAssetId
          ? { characterAssetId: autoCharacterAssetId }
          : {}),
        ...(resolvedOverrides?.faceSwapAlreadyApplied
          ? { faceSwapAlreadyApplied: true }
          : {}),
        ...(resolvedOverrides?.faceSwapUrl
          ? { faceSwapUrl: resolvedOverrides.faceSwapUrl }
          : {}),
        ...(mergedGenerationParams
          ? { generationParams: mergedGenerationParams }
          : {}),
        ...(resolvedOverrides?.generationParams
          ? { generationParams: resolvedOverrides.generationParams }
          : {}),
      });
    },
    [
      detectedCharacter?.id,
      faceSwapOverride,
      generateDraft,
      generateSequenceShot,
      hasActiveContinuityShot,
      hasCreditsFor,
      mergedGenerationParams,
      onCreateVersionIfNeeded,
      prompt,
      startFrame,
    ]
  );

  const {
    keyframeStep,
    selectedFrameUrl,
    handleRender,
    handleApproveKeyframe: approveKeyframeFromWorkflow,
    handleSkipKeyframe,
    handleSelectFrame: selectFrameInWorkflow,
    handleClearSelectedFrame: clearSelectedFrameInWorkflow,
  } = useKeyframeWorkflow({
    prompt,
    startFrame,
    setStartFrame,
    clearStartFrame,
    detectedCharacter,
    onCreateVersionIfNeeded,
    generateRender,
  });

  const handleApproveKeyframe = useCallback(
    (keyframeUrl: string) => {
      setStartFrame({
        id: `keyframe-step-${Date.now()}`,
        url: keyframeUrl,
        source: 'generation',
        ...(prompt.trim() ? { sourcePrompt: prompt.trim() } : {}),
      });
      approveKeyframeFromWorkflow(keyframeUrl);
    },
    [approveKeyframeFromWorkflow, prompt, setStartFrame]
  );

  const handleSelectFrame = useCallback(
    (url: string, frameIndex: number, generationId: string) => {
      const generation = generations.find((item) => item.id === generationId);
      const storagePath = generation?.mediaAssetIds?.[frameIndex];
      selectFrameInWorkflow(
        url,
        frameIndex,
        generationId,
        storagePath,
        generation?.prompt ?? prompt
      );
    },
    [generations, prompt, selectFrameInWorkflow]
  );

  const handleClearSelectedFrame = useCallback(() => {
    clearSelectedFrameInWorkflow();
  }, [clearSelectedFrameInWorkflow]);

  const handleRenderWithFaceSwap = useCallback(
    (model: string, overrides?: GenerationOverrides) => {
      if (hasActiveContinuityShot) {
        onCreateVersionIfNeeded();
        void generateSequenceShot(model);
        return;
      }
      const modelConfig = getModelConfig(model);
      const requiredCredits = modelConfig?.credits ?? 0;
      const operationLabel = `${modelConfig?.label ?? 'Video'} render`;
      if (!hasCreditsFor(requiredCredits, operationLabel)) {
        return;
      }
      if (!overrides && faceSwapOverride) {
        handleRender(model, faceSwapOverride);
        return;
      }
      handleRender(model, overrides);
    },
    [
      faceSwapOverride,
      generateSequenceShot,
      handleRender,
      hasActiveContinuityShot,
      hasCreditsFor,
      onCreateVersionIfNeeded,
    ]
  );

  const handleStoryboard = useCallback(() => {
    if (hasActiveContinuityShot) {
      onCreateVersionIfNeeded();
      void generateSequenceShot(VIDEO_DRAFT_MODEL.id);
      return;
    }
    const storyboardConfig = getModelConfig('flux-kontext');
    const requiredCredits = storyboardConfig?.credits ?? 4;
    if (!hasCreditsFor(requiredCredits, 'Storyboard')) {
      return;
    }
    const resolvedPrompt =
      prompt.trim() || 'Generate a storyboard based on the reference image.';
    const versionId = onCreateVersionIfNeeded();
    const seedImageUrl = startFrame?.url ?? null;
    generateStoryboard(resolvedPrompt, { promptVersionId: versionId, seedImageUrl });
  }, [
    generateStoryboard,
    generateSequenceShot,
    hasActiveContinuityShot,
    hasCreditsFor,
    onCreateVersionIfNeeded,
    prompt,
    startFrame?.url,
  ]);

  const handleDraftRef = useRef(handleDraft);
  handleDraftRef.current = handleDraft;
  const handleRenderWithFaceSwapRef = useRef(handleRenderWithFaceSwap);
  handleRenderWithFaceSwapRef.current = handleRenderWithFaceSwap;
  const handleStoryboardRef = useRef(handleStoryboard);
  handleStoryboardRef.current = handleStoryboard;

  const handleDraftForControls = useCallback(
    (model: DraftModel, overrides?: GenerationOverrides) => {
      handleDraftRef.current(model, overrides);
    },
    []
  );

  const handleRenderForControls = useCallback(
    (model: string, overrides?: GenerationOverrides) => {
      handleRenderWithFaceSwapRef.current(model, overrides);
    },
    []
  );

  const handleStoryboardForControls = useCallback(() => {
    handleStoryboardRef.current();
  }, []);

  const handleDelete = useCallback(
    (generation: Generation) => {
      if (hasActiveContinuityShot) return;
      removeGeneration(generation.id);
    },
    [hasActiveContinuityShot, removeGeneration]
  );

  const handleRetry = useCallback(
    (generation: Generation) => {
      if (hasActiveContinuityShot) {
        onCreateVersionIfNeeded();
        void generateSequenceShot(generation.model);
        return;
      }
      retryGeneration(generation.id);
    },
    [
      generateSequenceShot,
      hasActiveContinuityShot,
      onCreateVersionIfNeeded,
      retryGeneration,
    ]
  );

  const handleCancel = useCallback(
    (generation: Generation) => {
      if (hasActiveContinuityShot) return;
      cancelGeneration(generation.id);
    },
    [cancelGeneration, hasActiveContinuityShot]
  );

  const handleDownload = useCallback((generation: Generation) => {
    const url = generation.mediaUrls[0];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleContinueSequence = useCallback(
    async (generation: Generation) => {
      if (hasActiveContinuityShot || isStartingSequence) return;
      const mediaUrl = generation.mediaUrls[0] ?? null;
      const { assetId, storagePath } = resolvePrimaryVideoSource(
        mediaUrl,
        generation.mediaAssetIds?.[0] ?? null
      );
      const sourceVideoId = assetId ?? storagePath;
      const sourceImageUrl =
        typeof generation.thumbnailUrl === 'string' &&
        generation.thumbnailUrl.trim()
          ? generation.thumbnailUrl.trim()
          : null;

      if (!sourceVideoId) {
        log.warn('Cannot start sequence: missing source video ref', {
          generationId: generation.id,
          mediaUrl,
          mediaAssetId: generation.mediaAssetIds?.[0] ?? null,
          routeSessionId: currentSessionId ?? null,
          currentPromptDocId,
        });
        toast.warning('Unable to start a sequence from this generation.');
        return;
      }

      const routeSessionIdAtStart = currentSessionId ?? null;
      const originSessionId =
        routeSessionIdAtStart ?? currentPromptDocId ?? workspaceSession?.id ?? null;
      log.info('Starting sequence', {
        generationId: generation.id,
        sourceVideoId,
        routeSessionId: routeSessionIdAtStart,
        currentPromptDocId,
        originSessionId,
      });

      try {
        const { sessionId: sequenceSessionId } = await startSequence({
          sourceVideoId,
          ...(sourceImageUrl ? { sourceImageUrl } : {}),
          prompt: generation.prompt,
          ...(originSessionId ? { originSessionId } : {}),
        });

        if (currentRouteSessionIdRef.current !== routeSessionIdAtStart) {
          log.info('Skipping sequence navigation after route changed during startup', {
            generationId: generation.id,
            routeSessionIdAtStart,
            routeSessionIdCurrent: currentRouteSessionIdRef.current ?? null,
            sequenceSessionId,
          });
          return;
        }

        if (sequenceSessionId && sequenceSessionId !== originSessionId) {
          const originParam = originSessionId
            ? `?originSessionId=${encodeURIComponent(originSessionId)}`
            : '';
          navigate(
            `/session/${encodeURIComponent(sequenceSessionId)}${originParam}`
          );
        }

        log.info('Sequence started from generation', {
          generationId: generation.id,
          sequenceSessionId,
          originSessionId,
        });
        toast.success('Sequence mode enabled.');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to start sequence from generation', err, {
          generationId: generation.id,
          sourceVideoId,
          routeSessionId: currentSessionId ?? null,
          currentPromptDocId,
          originSessionId,
        });
        toast.error(
          error instanceof Error ? error.message : 'Failed to start sequence'
        );
      }
    },
    [
      currentPromptDocId,
      currentSessionId,
      hasActiveContinuityShot,
      isStartingSequence,
      navigate,
      startSequence,
      toast,
      workspaceSession?.id,
    ]
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
  const totalVisibleGenerations = useMemo(
    () => timeline.filter((item) => item.type === 'generation').length,
    [timeline]
  );

  const isNonStoryboardGenerating = useMemo(
    () =>
      generations.some(
        (generation) =>
          generation.mediaType !== 'image-sequence' &&
          (generation.status === 'pending' || generation.status === 'generating')
      ),
    [generations]
  );

  const controlsIsGenerating =
    presentation === 'hero' ? isNonStoryboardGenerating : isGenerating;

  const controlsPayload = useMemo(
    () => ({
      onDraft: handleDraftForControls,
      onRender: handleRenderForControls,
      onStoryboard: handleStoryboardForControls,
      isGenerating: controlsIsGenerating,
      activeDraftModel,
    }),
    [
      activeDraftModel,
      controlsIsGenerating,
      handleDraftForControls,
      handleRenderForControls,
      handleStoryboardForControls,
    ]
  );

  useEffect(() => {
    setControls(controlsPayload);
    return () => setControls(null);
  }, [controlsPayload, setControls]);

  const activeGeneration = useMemo(() => {
    if (generations.length === 0) return null;
    if (activeGenerationId) {
      const matched = generations.find(
        (generation) => generation.id === activeGenerationId
      );
      if (matched) return matched;
    }
    return generations[generations.length - 1] ?? null;
  }, [activeGenerationId, generations]);

  const heroGeneration = useMemo(() => {
    const overrideId = heroOverrideGenerationId ?? null;
    if (overrideId) {
      const overrideMatch = generations.find(
        (generation) => generation.id === overrideId
      );
      if (overrideMatch && overrideMatch.mediaType !== 'image-sequence') {
        return overrideMatch;
      }
    }
    if (activeGeneration && activeGeneration.mediaType !== 'image-sequence') {
      return activeGeneration;
    }
    const nonStoryboardGenerations = generations.filter(
      (generation) => generation.mediaType !== 'image-sequence'
    );
    return nonStoryboardGenerations[nonStoryboardGenerations.length - 1] ?? null;
  }, [activeGeneration, generations, heroOverrideGenerationId]);

  const onStateSnapshotRef = useRef(onStateSnapshot);
  onStateSnapshotRef.current = onStateSnapshot;

  useEffect(() => {
    const callback = onStateSnapshotRef.current;
    if (!callback) return;
    const snapshot: GenerationsPanelStateSnapshot = {
      generations,
      activeGenerationId,
      isGenerating,
      selectedFrameUrl: selectedFrameUrl ?? null,
    };
    callback(snapshot);
  }, [activeGenerationId, generations, isGenerating, selectedFrameUrl]);

  return {
    generations,
    activeGenerationId,
    isGenerating,
    selectedFrameUrl: selectedFrameUrl ?? null,
    keyframeStep,
    timeline,
    totalVisibleGenerations,
    isSequenceMode,
    hasActiveContinuityShot,
    isStartingSequence,
    heroGeneration,
    activeDraftModel,
    handleDraft,
    handleRenderWithFaceSwap,
    handleStoryboard,
    handleApproveKeyframe,
    handleSkipKeyframe,
    handleRetry,
    handleDelete,
    handleDownload,
    handleCancel,
    handleContinueSequence,
    handleSelectFrame,
    handleClearSelectedFrame,
    setActiveGeneration,
  };
}
