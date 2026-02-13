import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Trash2, Wand2, X } from '@promptstudio/system/components/ui';
import { VIDEO_DRAFT_MODEL } from '@components/ToolSidebar/config/modelConfig';
import { CameraMotionModal } from '@components/modals/CameraMotionModal';
import { useToast } from '@components/Toast';
import { GenerationFooter } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter';
import { VideoSettingsRow } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/components/VideoSettingsRow';
import { useCapabilitiesClamping } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping';
import { useModelSelectionRecommendation } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation';
import type { VideoTier } from '@components/ToolSidebar/types';
import type { CameraPath } from '@/features/convergence/types';
import type { ContinuityShot } from '@/features/continuity/types';
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

const normalizeRef = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildImageCandidates = (...values: Array<string | null | undefined>): string[] => {
  const normalized = values
    .map((value) => normalizeRef(value))
    .filter((value): value is string => Boolean(value));
  return [...new Set(normalized)];
};

const resolveShotReferenceImage = (shot: ContinuityShot | null): string | null =>
  normalizeRef(shot?.frameBridge?.frameUrl ?? shot?.styleReference?.frameUrl ?? shot?.generatedKeyframeUrl ?? null);

const roundCameraValue = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;

const formatCameraValue = (value: number | undefined): string =>
  `${Number.isFinite(value) ? Number(value).toFixed(2) : '0.00'}`;

type SceneProxyCameraInput = {
  yaw?: number;
  pitch?: number;
  roll?: number;
  dolly?: number;
};

const SCENE_PROXY_PREVIEW_MIN_LATERAL_DELTA = 0.01;
const SCENE_PROXY_PREVIEW_DEFAULT_YAW = 0.35;

const normalizeCameraInput = (
  camera: ContinuityShot['camera'] | null | undefined
): SceneProxyCameraInput | undefined => {
  if (!camera) return undefined;

  const normalized: SceneProxyCameraInput = {
    ...(typeof camera.yaw === 'number' ? { yaw: camera.yaw } : {}),
    ...(typeof camera.pitch === 'number' ? { pitch: camera.pitch } : {}),
    ...(typeof camera.roll === 'number' ? { roll: camera.roll } : {}),
    ...(typeof camera.dolly === 'number' ? { dolly: camera.dolly } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const cameraPathToShotCamera = (
  cameraPath: CameraPath
): SceneProxyCameraInput => ({
  yaw: roundCameraValue(cameraPath.end.rotation.yaw - cameraPath.start.rotation.yaw),
  pitch: roundCameraValue(cameraPath.end.rotation.pitch - cameraPath.start.rotation.pitch),
  roll: roundCameraValue(cameraPath.end.rotation.roll - cameraPath.start.rotation.roll),
  dolly: roundCameraValue(cameraPath.end.position.z - cameraPath.start.position.z),
});

const cameraInputValue = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? roundCameraValue(value) : null;

const areCameraInputsEqual = (
  left: SceneProxyCameraInput | undefined,
  right: SceneProxyCameraInput | undefined
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    cameraInputValue(left.yaw) === cameraInputValue(right.yaw) &&
    cameraInputValue(left.pitch) === cameraInputValue(right.pitch) &&
    cameraInputValue(left.roll) === cameraInputValue(right.roll) &&
    cameraInputValue(left.dolly) === cameraInputValue(right.dolly)
  );
};

const withSceneProxyPreviewFallback = (
  camera: SceneProxyCameraInput,
  continuityMode: SessionContinuityMode
): SceneProxyCameraInput => {
  if (continuityMode !== 'style-match') return camera;
  const yaw = Math.abs(camera.yaw ?? 0);
  const dolly = Math.abs(camera.dolly ?? 0);
  if (
    yaw >= SCENE_PROXY_PREVIEW_MIN_LATERAL_DELTA ||
    dolly >= SCENE_PROXY_PREVIEW_MIN_LATERAL_DELTA
  ) {
    return camera;
  }
  return {
    ...camera,
    yaw: SCENE_PROXY_PREVIEW_DEFAULT_YAW,
  };
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
  const [isCameraMotionModalOpen, setIsCameraMotionModalOpen] = useState(false);
  const { copy } = useClipboard();
  const toast = useToast();

  const {
    session,
    shots,
    currentShotId,
    currentShot,
    currentShotIndex,
    setCurrentShotId,
    updateShot,
    generateShot,
    createSceneProxy,
    isCreatingSceneProxy,
    previewSceneProxy,
    isPreviewingSceneProxy,
  } = useWorkspaceSession();

  const { domain } = useGenerationControlsStoreState();
  const { setSelectedModel, setVideoTier, mergeGenerationParams, setCameraMotion } = useGenerationControlsStoreActions();
  const promptHighlights = useOptionalPromptHighlights();

  const selectedModel = domain.selectedModel;
  const tier = domain.videoTier;
  const startFrame = domain.startFrame;
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

  const motionSource = useMemo(() => {
    const keyframeUrl = normalizeRef(startFrame?.url ?? null);
    if (keyframeUrl) {
      return {
        imageUrl: keyframeUrl,
        imageStoragePath: startFrame?.storagePath ?? null,
        imageAssetId: startFrame?.assetId ?? null,
      };
    }

    const previousShotFrameUrl = resolveShotReferenceImage(previousShot);
    if (previousShotFrameUrl) {
      return {
        imageUrl: previousShotFrameUrl,
        imageStoragePath: null,
        imageAssetId: null,
      };
    }

    const primaryStyleFrameUrl = normalizeRef(session?.continuity?.primaryStyleReference?.frameUrl ?? null);
    if (primaryStyleFrameUrl) {
      return {
        imageUrl: primaryStyleFrameUrl,
        imageStoragePath: null,
        imageAssetId: null,
      };
    }

    return null;
  }, [previousShot, session?.continuity?.primaryStyleReference?.frameUrl, startFrame]);

  const sceneProxySource = useMemo(
    () => orderedShots.find((shot) => Boolean(shot.videoAssetId)) ?? null,
    [orderedShots]
  );

  const sceneProxySourceVideoId = normalizeRef(sceneProxySource?.videoAssetId ?? null);
  const sceneProxyStatus = session?.continuity?.sceneProxy?.status ?? null;
  const isSceneProxyReady = sceneProxyStatus === 'ready';
  const canCreateSceneProxy = Boolean(sceneProxySource?.id || sceneProxySourceVideoId);
  const sceneProxyReferenceFrameUrl = normalizeRef(session?.continuity?.sceneProxy?.referenceFrameUrl ?? null);

  const {
    modelRecommendation,
    recommendedModelId,
    efficientModelId,
    renderModelOptions,
    renderModelId,
  } = useModelSelectionRecommendation({
    prompt: promptText,
    activeTab: 'video',
    keyframesCount: startFrame ? 1 : 0,
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

  const handleOpenCameraMotion = useCallback((): void => {
    if (!motionSource) return;
    setIsCameraMotionModalOpen(true);
  }, [motionSource]);

  const handleCloseCameraMotion = useCallback((): void => {
    setIsCameraMotionModalOpen(false);
  }, []);

  const handleSelectCameraMotion = useCallback(
    (cameraPath: CameraPath): void => {
      setCameraMotion(cameraPath);
      if (!currentShot) return;
      const camera = cameraPathToShotCamera(cameraPath);
      void (async () => {
        try {
          await updateShot(currentShot.id, { camera });
          if (currentShot.continuityMode === 'style-match' && isSceneProxyReady) {
            await previewSceneProxy(currentShot.id, camera);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to apply camera motion');
        }
      })();
    },
    [currentShot, isSceneProxyReady, previewSceneProxy, setCameraMotion, toast, updateShot]
  );

  const handlePreviewSceneProxy = useCallback(async (): Promise<void> => {
    if (!currentShot) return;

    const existingCamera = normalizeCameraInput(currentShot.camera);
    const resolvedCameraInput =
      existingCamera ??
      (domain.cameraMotion ? cameraPathToShotCamera(domain.cameraMotion) : undefined);

    if (!resolvedCameraInput) {
      toast.warning('Select camera motion before previewing an angle.');
      return;
    }

    const resolvedCamera = withSceneProxyPreviewFallback(
      resolvedCameraInput,
      currentShot.continuityMode
    );

    try {
      if (!areCameraInputsEqual(existingCamera, resolvedCamera)) {
        await updateShot(currentShot.id, { camera: resolvedCamera });
      }
      await previewSceneProxy(currentShot.id, resolvedCamera);
      toast.success('Angle preview updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to render scene proxy preview');
    }
  }, [currentShot, domain.cameraMotion, previewSceneProxy, toast, updateShot]);

  const handleCreateSceneProxy = useCallback(async (): Promise<void> => {
    if (!canCreateSceneProxy) {
      toast.warning('Generate or select a source shot before creating a scene proxy.');
      return;
    }

    try {
      await createSceneProxy({
        ...(sceneProxySource?.id ? { sourceShotId: sceneProxySource.id } : {}),
        ...(sceneProxySourceVideoId ? { sourceVideoId: sceneProxySourceVideoId } : {}),
      });
      toast.success('Scene proxy is ready for continuity generation.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create scene proxy');
    }
  }, [canCreateSceneProxy, createSceneProxy, sceneProxySource?.id, sceneProxySourceVideoId, toast]);

  const isGenerateDisabled =
    !currentShot ||
    !promptText.trim() ||
    isGenerating ||
    currentShot.status === 'generating-keyframe' ||
    currentShot.status === 'generating-video';

  const generateLabel = currentShotIndex >= 0 ? `Generate Shot ${currentShotIndex + 1}` : 'Generate';
  const shouldShowSceneProxyPreview =
    Boolean(currentShot) &&
    currentShotIndex > 0 &&
    currentShot?.continuityMode === 'style-match';
  const previewImageCandidates = useMemo(
    () =>
      buildImageCandidates(
        currentShot?.sceneProxyRenderUrl ?? null,
        sceneProxyReferenceFrameUrl,
        resolveShotReferenceImage(currentShot),
        resolveShotReferenceImage(previousShot)
      ),
    [currentShot, previousShot, sceneProxyReferenceFrameUrl]
  );
  const previewImageCandidateKey = previewImageCandidates.join('|');
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  React.useEffect(() => {
    setPreviewImageIndex(0);
  }, [previewImageCandidateKey]);
  const previewImageUrl =
    previewImageIndex >= 0 && previewImageIndex < previewImageCandidates.length
      ? previewImageCandidates[previewImageIndex] ?? null
      : null;
  const handlePreviewImageError = useCallback((): void => {
    setPreviewImageIndex((current) => {
      const next = current + 1;
      return next < previewImageCandidates.length ? next : previewImageCandidates.length;
    });
  }, [previewImageCandidates.length]);
  const previewCamera =
    normalizeCameraInput(currentShot?.camera ?? null) ??
    (domain.cameraMotion ? cameraPathToShotCamera(domain.cameraMotion) : null);

  return (
    <main id="main-content" className="flex h-full min-h-0 flex-col bg-[#111318]">
      <header className="flex h-12 items-center border-b border-border px-3">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Sequence
        </span>
        <span className="ml-2 flex-1 truncate text-sm text-foreground">{session?.name || 'Untitled session'}</span>
        <span
          className="mr-2 rounded-md border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted"
          data-testid="scene-proxy-status"
        >
          {isSceneProxyReady ? 'Scene proxy ready' : 'Scene proxy off'}
        </span>
        <button
          type="button"
          onClick={() => void handleCreateSceneProxy()}
          disabled={!canCreateSceneProxy || isCreatingSceneProxy}
          className="mr-2 inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-muted transition-colors hover:bg-surface-1 hover:text-foreground disabled:opacity-50"
          aria-label="Create scene proxy"
        >
          {isCreatingSceneProxy ? 'Building proxy...' : isSceneProxyReady ? 'Rebuild proxy' : 'Build proxy'}
        </button>
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

          {shouldShowSceneProxyPreview && (
            <section
              className="overflow-hidden rounded-lg border border-border bg-surface-2"
              data-testid="scene-proxy-preview-panel"
            >
              <header className="flex items-center justify-between border-b border-border bg-black/20 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Scene proxy preview
                </span>
                <span className="text-[11px] text-muted">
                  {isSceneProxyReady ? 'Ready' : 'Build proxy first'}
                </span>
              </header>

              <div className="relative h-[110px] w-full">
                {previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt="Scene proxy preview"
                    className="h-full w-full object-cover"
                    onError={handlePreviewImageError}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#161A21]">
                    <span className="text-xs text-muted">No proxy preview yet</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button
                  type="button"
                  onClick={() => void handlePreviewSceneProxy()}
                  disabled={!isSceneProxyReady || isPreviewingSceneProxy}
                  className="absolute bottom-2 right-2 rounded border border-border bg-black/55 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur-sm disabled:opacity-50"
                  data-testid="preview-scene-proxy-button"
                >
                  {isPreviewingSceneProxy ? 'Rendering...' : 'Preview angle'}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 border-t border-border px-3 py-2 text-[11px] text-muted">
                <span>Yaw: {formatCameraValue(previewCamera?.yaw)}</span>
                <span>Pitch: {formatCameraValue(previewCamera?.pitch)}</span>
                <span>Roll: {formatCameraValue(previewCamera?.roll)}</span>
                <span>Dolly: {formatCameraValue(previewCamera?.dolly)}</span>
              </div>
            </section>
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
        onOpenMotion={handleOpenCameraMotion}
        isMotionDisabled={!motionSource}
      />

      {motionSource && (
        <CameraMotionModal
          isOpen={isCameraMotionModalOpen}
          onClose={handleCloseCameraMotion}
          imageUrl={motionSource.imageUrl}
          imageStoragePath={motionSource.imageStoragePath}
          imageAssetId={motionSource.imageAssetId}
          onSelect={handleSelectCameraMotion}
          initialSelection={domain.cameraMotion}
        />
      )}

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
