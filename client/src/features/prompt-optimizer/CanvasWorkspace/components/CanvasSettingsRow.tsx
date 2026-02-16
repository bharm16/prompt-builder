import React, { useCallback, useMemo } from 'react';
import { Sparkles, Folder } from '@promptstudio/system/components/ui';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS, STORYBOARD_COST } from '@/components/ToolSidebar/config/modelConfig';
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
  onStartFrameUpload?: ((file: File) => void | Promise<void>) | undefined;
  onEnhance?: () => void;
}

const parseAspectRatio = (generationParams: Record<string, unknown>): string => {
  const ratio = generationParams.aspect_ratio;
  if (typeof ratio === 'string' && ratio.trim()) return ratio.trim();
  return '16:9';
};

const parseDuration = (generationParams: Record<string, unknown>): number => {
  const durationValue = generationParams.duration_s;
  if (typeof durationValue === 'number' && Number.isFinite(durationValue)) return durationValue;
  if (typeof durationValue === 'string') {
    const parsed = Number.parseFloat(durationValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 5;
};

/* Ghost button used across the settings row — matches mockup BarBtn exactly */
function BarBtn({
  children,
  active,
  accent,
  onClick,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  accent?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[30px] items-center gap-[5px] whitespace-nowrap rounded-lg border-none px-2.5 text-xs transition-colors ${
        accent
          ? 'font-semibold text-[#6C5CE7] hover:bg-[#1C1E26]'
          : active
            ? 'bg-[#1C1E26] font-medium text-[#E2E6EF]'
            : 'bg-transparent font-medium text-[#555B6E] hover:bg-[#1C1E26] hover:text-[#E2E6EF]'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function CanvasSettingsRow({
  prompt,
  renderModelId,
  recommendedModelId,
  recommendationPromptId,
  recommendationMode,
  recommendationAgeMs,
  onOpenMotion,
  onStartFrameUpload,
  onEnhance,
}: CanvasSettingsRowProps): React.ReactElement {
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

  const { aspectRatioOptions, durationOptions } = useCapabilitiesClamping({
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

  const isWan = domain.selectedModel === VIDEO_DRAFT_MODEL.id;

  const previewDisabled = !controls?.onStoryboard || isGenerating || (!hasPrompt && !hasStartFrame);
  const generateDisabled = isWan
    ? !controls?.onDraft || isGenerating || !hasPrompt
    : !controls?.onRender || isGenerating || !hasPrompt;

  const trackGenerationStart = useCallback(
    (selectedModelId: string) => {
      void trackModelRecommendationEvent({
        event: 'generation_started',
        ...(recommendationPromptId ? { recommendationId: recommendationPromptId, promptId: recommendationPromptId } : {}),
        ...(recommendedModelId ? { recommendedModelId } : {}),
        selectedModelId,
        ...(recommendationMode ? { mode: recommendationMode } : {}),
        durationSeconds: duration,
        ...(typeof recommendationAgeMs === 'number'
          ? { timeSinceRecommendationMs: Math.max(0, Math.round(recommendationAgeMs)) }
          : {}),
      });
    },
    [duration, recommendationAgeMs, recommendationMode, recommendationPromptId, recommendedModelId]
  );

  const handleGenerate = useCallback(() => {
    if (isWan) {
      trackGenerationStart(VIDEO_DRAFT_MODEL.id);
      controls?.onDraft?.(VIDEO_DRAFT_MODEL.id);
    } else {
      trackGenerationStart(renderModelId);
      controls?.onRender?.(renderModelId);
    }
  }, [controls, isWan, renderModelId, trackGenerationStart]);

  /* Cycle through aspect ratio options on click */
  const handleAspectRatioClick = useCallback(() => {
    if (!aspectRatioOptions.length) return;
    const currentIndex = aspectRatioOptions.indexOf(aspectRatio);
    const nextIndex = (currentIndex + 1) % aspectRatioOptions.length;
    const nextAspectRatio = aspectRatioOptions[nextIndex];
    if (!nextAspectRatio) return;
    handleAspectRatioChange(nextAspectRatio);
  }, [aspectRatio, aspectRatioOptions, handleAspectRatioChange]);

  /* Cycle through duration options on click */
  const handleDurationClick = useCallback(() => {
    if (!durationOptions.length) return;
    const currentIndex = durationOptions.indexOf(duration);
    const nextIndex = (currentIndex + 1) % durationOptions.length;
    const nextDuration = durationOptions[nextIndex];
    if (typeof nextDuration !== 'number') return;
    handleDurationChange(nextDuration);
  }, [duration, durationOptions, handleDurationChange]);

  const creditCost = isWan ? VIDEO_DRAFT_MODEL.cost : renderModelCost;

  return (
    <div
      className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-[#181A20] pt-2.5"
      data-testid="canvas-settings-row"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {/* Start frame (with popover) */}
        <StartFramePopover
          startFrame={domain.startFrame}
          cameraMotion={domain.cameraMotion}
          onSetStartFrame={storeActions.setStartFrame}
          onClearStartFrame={storeActions.clearStartFrame}
          onOpenMotion={onOpenMotion}
          onStartFrameUpload={onStartFrameUpload}
          disabled={isGenerating}
        />

        {/* Assets */}
        <BarBtn onClick={(e) => e.stopPropagation()}>
          <span className="flex opacity-60"><Folder size={13} /></span>
          Assets
        </BarBtn>

        {/* Aspect ratio — cycle on click */}
        <BarBtn onClick={handleAspectRatioClick}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2" width="9" height="7" rx="1.5"/></svg>
          {aspectRatio}
        </BarBtn>

        {/* Duration — cycle on click */}
        <BarBtn onClick={handleDurationClick}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4.5"/><path d="M5.5 3v3l2 1"/></svg>
          {duration}s
        </BarBtn>

        {/* AI Enhance */}
        <BarBtn
          accent
          {...(onEnhance
            ? {
                onClick: (event: React.MouseEvent) => {
                  event.stopPropagation();
                  onEnhance();
                },
              }
            : {})}
        >
          <Sparkles size={13} />
          Enhance
        </BarBtn>
      </div>

      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap">
        {/* Preview button (secondary) */}
        <button
          type="button"
          data-testid="canvas-preview-button"
          className="inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#22252C] bg-transparent px-2.5 text-[11px] font-semibold text-[#8B92A5] transition-colors hover:border-[#3A3D46] hover:text-[#E2E6EF] disabled:cursor-not-allowed disabled:text-[#3A3E4C] sm:px-3.5 sm:text-xs"
          onClick={() => controls?.onStoryboard?.()}
          disabled={previewDisabled}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="5" height="4" rx="0.8"/><rect x="7" y="2.5" width="5" height="4" rx="0.8"/><rect x="1" y="7.5" width="5" height="4" rx="0.8"/><rect x="7" y="7.5" width="5" height="4" rx="0.8"/></svg>
          Preview · {STORYBOARD_COST} cr
        </button>

        {/* Generate button (primary) */}
        <button
          type="button"
          data-testid="canvas-generate-button"
          className={`inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[11px] font-bold tracking-[0.01em] transition-opacity hover:opacity-[0.85] disabled:cursor-not-allowed disabled:opacity-60 sm:px-[18px] sm:text-xs ${
            isWan
              ? 'border border-[#E2E6EF] bg-transparent text-[#E2E6EF]'
              : 'border-none bg-[#E2E6EF] text-[#0D0E12]'
          }`}
          onClick={handleGenerate}
          disabled={generateDisabled}
        >
          {isWan ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1v3M6 8v3M9 3L7.5 5.5M4.5 6.5L3 9M3 3l1.5 2.5M7.5 6.5L9 9"/></svg>
              Draft · {creditCost} cr
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2l-1 3.5L1 6.5l3.5 1L5.5 11l1-3.5L10 6.5 6.5 5.5z"/><path d="M10.5 1l-.5 1.5L8.5 3l1.5.5.5 1.5.5-1.5L13 3l-1.5-.5z"/></svg>
              Generate · {creditCost} cr
            </>
          )}
        </button>
      </div>
    </div>
  );
}
