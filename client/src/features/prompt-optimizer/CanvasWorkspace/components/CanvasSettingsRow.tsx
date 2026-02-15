import React, { useCallback, useMemo } from 'react';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS, STORYBOARD_COST } from '@/components/ToolSidebar/config/modelConfig';
import { useSidebarGenerationDomain } from '@/components/ToolSidebar/context';
import { useGenerationControlsContext } from '@/features/prompt-optimizer/context/GenerationControlsContext';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useCapabilitiesClamping } from '@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping';
import { trackModelRecommendationEvent } from '@/features/model-intelligence/api';
import { StartFramePopover } from './StartFramePopover';

interface CanvasSettingsRowProps {
  prompt: string;
  renderModelId: string;
  recommendedModelId?: string | undefined;
  recommendationPromptId?: string | undefined;
  recommendationMode?: 't2v' | 'i2v' | undefined;
  recommendationAgeMs?: number | null | undefined;
  onOpenMotion: () => void;
}

const parseAspectRatio = (generationParams: Record<string, unknown>): string => {
  const ratio = generationParams.aspect_ratio;
  if (typeof ratio === 'string' && ratio.trim()) {
    return ratio.trim();
  }
  return '16:9';
};

const parseDuration = (generationParams: Record<string, unknown>): number => {
  const durationValue = generationParams.duration_s;
  if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
    return durationValue;
  }
  if (typeof durationValue === 'string') {
    const parsed = Number.parseFloat(durationValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 5;
};

export function CanvasSettingsRow({
  prompt,
  renderModelId,
  recommendedModelId,
  recommendationPromptId,
  recommendationMode,
  recommendationAgeMs,
  onOpenMotion,
}: CanvasSettingsRowProps): React.ReactElement {
  const generationDomain = useSidebarGenerationDomain();
  const { controls } = useGenerationControlsContext();
  const { domain } = useGenerationControlsStoreState();
  const storeActions = useGenerationControlsStoreActions();

  const aspectRatio = useMemo(
    () => parseAspectRatio(domain.generationParams as Record<string, unknown>),
    [domain.generationParams]
  );
  const duration = useMemo(
    () => parseDuration(domain.generationParams as Record<string, unknown>),
    [domain.generationParams]
  );

  const hasPrompt = Boolean(prompt.trim());
  const hasStartFrame = Boolean(domain.startFrame);
  const isGenerating = controls?.isGenerating ?? false;

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      storeActions.mergeGenerationParams({ aspect_ratio: value });
    },
    [storeActions]
  );

  const handleDurationChange = useCallback(
    (value: number) => {
      storeActions.mergeGenerationParams({ duration_s: value });
    },
    [storeActions]
  );

  const {
    aspectRatioInfo,
    durationInfo,
    aspectRatioOptions,
    durationOptions,
  } = useCapabilitiesClamping({
    activeTab: 'video',
    selectedModel: domain.selectedModel,
    videoTier: domain.videoTier,
    renderModelId,
    aspectRatio,
    duration,
    setVideoTier: storeActions.setVideoTier,
    onAspectRatioChange: handleAspectRatioChange,
    onDurationChange: handleDurationChange,
  });

  const renderModelCost =
    VIDEO_RENDER_MODELS.find((model) => model.id === renderModelId)?.cost ??
    VIDEO_RENDER_MODELS[0]?.cost ??
    0;

  const previewDisabled =
    !controls?.onStoryboard || isGenerating || (!hasPrompt && !hasStartFrame);
  const draftDisabled = !controls?.onDraft || isGenerating || !hasPrompt;
  const renderDisabled = !controls?.onRender || isGenerating || !hasPrompt;

  const trackGenerationStart = useCallback(
    (selectedModelId: string) => {
      void trackModelRecommendationEvent({
        event: 'generation_started',
        ...(recommendationPromptId ? { recommendationId: recommendationPromptId } : {}),
        ...(recommendationPromptId ? { promptId: recommendationPromptId } : {}),
        ...(recommendedModelId ? { recommendedModelId } : {}),
        selectedModelId,
        ...(recommendationMode ? { mode: recommendationMode } : {}),
        durationSeconds: duration,
        ...(typeof recommendationAgeMs === 'number'
          ? {
              timeSinceRecommendationMs: Math.max(
                0,
                Math.round(recommendationAgeMs)
              ),
            }
          : {}),
      });
    },
    [
      duration,
      recommendationAgeMs,
      recommendationMode,
      recommendationPromptId,
      recommendedModelId,
    ]
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t border-[#1A1C22] bg-[#0F1117] px-3 py-2"
      data-testid="canvas-settings-row"
    >
      <StartFramePopover
        startFrame={domain.startFrame}
        cameraMotion={domain.cameraMotion}
        onSetStartFrame={storeActions.setStartFrame}
        onClearStartFrame={storeActions.clearStartFrame}
        onOpenMotion={onOpenMotion}
        onStartFrameUpload={generationDomain?.onStartFrameUpload}
        disabled={isGenerating}
      />

      {hasStartFrame ? (
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-lg border border-[#2F254B] bg-[#1A1530] px-2.5 text-[11px] font-semibold text-[#C4B5FD] transition-colors hover:bg-[#201A3A]"
          onClick={onOpenMotion}
          data-testid="canvas-motion-button"
        >
          {domain.cameraMotion?.label
            ? `Motion: ${domain.cameraMotion.label}`
            : 'Add motion'}
        </button>
      ) : null}

      <label className="inline-flex items-center gap-1 rounded-lg border border-[#22252C] bg-[#111318] px-2 text-[11px] text-[#8B92A5]">
        <span>Aspect</span>
        <select
          data-testid="canvas-aspect-ratio-select"
          className="h-7 bg-transparent text-[11px] font-semibold text-[#E2E6EF] outline-none"
          value={aspectRatio}
          onChange={(event) => handleAspectRatioChange(event.target.value)}
          disabled={Boolean(aspectRatioInfo?.state.disabled)}
        >
          {aspectRatioOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="inline-flex items-center gap-1 rounded-lg border border-[#22252C] bg-[#111318] px-2 text-[11px] text-[#8B92A5]">
        <span>Duration</span>
        <select
          data-testid="canvas-duration-select"
          className="h-7 bg-transparent text-[11px] font-semibold text-[#E2E6EF] outline-none"
          value={duration}
          onChange={(event) => handleDurationChange(Number(event.target.value))}
          disabled={Boolean(durationInfo?.state.disabled)}
        >
          {durationOptions.map((option) => (
            <option key={option} value={option}>
              {option}s
            </option>
          ))}
        </select>
      </label>

      <div className="flex-1" />

      <button
        type="button"
        data-testid="canvas-preview-button"
        className="h-8 rounded-lg border border-[#22252C] bg-[#111318] px-3 text-[11px] font-semibold text-[#E2E6EF] transition-colors hover:border-[#3A3D46] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => controls?.onStoryboard?.()}
        disabled={previewDisabled}
      >
        Preview · {STORYBOARD_COST} cr
      </button>

      <button
        type="button"
        data-testid="canvas-draft-button"
        className="h-8 rounded-lg border border-[#2B4130] bg-[#17271D] px-3 text-[11px] font-semibold text-[#86EFAC] transition-colors hover:bg-[#1C3124] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          trackGenerationStart(VIDEO_DRAFT_MODEL.id);
          controls?.onDraft?.(VIDEO_DRAFT_MODEL.id);
        }}
        disabled={draftDisabled}
      >
        Draft · {VIDEO_DRAFT_MODEL.cost} cr
      </button>

      <button
        type="button"
        data-testid="canvas-render-button"
        className="h-8 rounded-lg border border-[#6C5CE7] bg-[#6C5CE7] px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          trackGenerationStart(renderModelId);
          controls?.onRender?.(renderModelId);
        }}
        disabled={renderDisabled}
      >
        Generate · {renderModelCost} cr
      </button>
    </div>
  );
}
