import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Eye, MagicWand, X } from "@promptstudio/system/components/ui";
import type { SidebarUploadedImage } from "@features/generation-controls";
import {
  VIDEO_DRAFT_MODELS,
  VIDEO_RENDER_MODELS,
  STORYBOARD_COST,
  getVideoCost,
} from "@/components/ToolSidebar/config/modelConfig";
import { getDefaultGenerationDurationSeconds } from "@shared/generationPricing";
import { useGenerationControlsContext } from "@/features/prompt-optimizer/context/GenerationControlsContext";
import { useCreditBalance } from "@/contexts/CreditBalanceContext";
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from "@features/generation-controls";
import { useCapabilitiesClamping } from "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping";
import { useVideoInputCapabilities } from "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useVideoInputCapabilities";
import { trackModelRecommendationEvent } from "@/features/model-intelligence/api";
import { StartFramePopover } from "./StartFramePopover";
import { EndFramePopover } from "./EndFramePopover";
import { VideoReferencesPopover } from "./VideoReferencesPopover";
import { MiniDropdown } from "./MiniDropdown";

interface CanvasSettingsRowProps {
  prompt: string;
  renderModelId: string;
  recommendedModelId?: string | undefined;
  recommendationPromptId?: string | undefined;
  recommendationMode?: "t2v" | "i2v" | undefined;
  recommendationAgeMs?: number | null | undefined;
  onOpenMotion: () => void;
  onStartFrameUpload?: ((file: File) => void | Promise<void>) | undefined;
  onUploadSidebarImage?:
    | ((file: File) => Promise<SidebarUploadedImage | null>)
    | undefined;
  onEnhance?: () => void;
  isEnhancing?: boolean;
}

const parseAspectRatio = (
  generationParams: Record<string, unknown>,
): string => {
  const ratio = generationParams.aspect_ratio;
  if (typeof ratio === "string" && ratio.trim()) return ratio.trim();
  return "16:9";
};

const parseDuration = (generationParams: Record<string, unknown>): number => {
  const durationValue = generationParams.duration_s;
  if (typeof durationValue === "number" && Number.isFinite(durationValue))
    return durationValue;
  if (typeof durationValue === "string") {
    const parsed = Number.parseFloat(durationValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return getDefaultGenerationDurationSeconds();
};

// C8 cooldown window: how long after a Preview-storyboard click we drop
// repeat clicks. Sized to outlast the multi-step prelude (optimize →
// session-create) that gates the upstream isSubmittingRef flip.
const PREVIEW_CLICK_COOLDOWN_MS = 2000;

/* Ghost button used across the settings row — flat, borderless, text-only */
function BarBtn({
  children,
  accent,
  onClick,
  className,
  ...buttonProps
}: {
  children: React.ReactNode;
  accent?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      {...buttonProps}
      className={`inline-flex h-[28px] items-center gap-[5px] whitespace-nowrap rounded-md px-2 text-xs transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${
        accent ? "text-foreground" : "text-tool-text-muted"
      } ${className ?? ""}`}
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
  onUploadSidebarImage,
  onEnhance,
  isEnhancing = false,
}: CanvasSettingsRowProps): React.ReactElement {
  const { controls, onInsufficientCredits } = useGenerationControlsContext();
  const { balance: creditBalance } = useCreditBalance();
  const { domain } = useGenerationControlsStoreState();
  const storeActions = useGenerationControlsStoreActions();

  const aspectRatio = useMemo(
    () => parseAspectRatio(domain.generationParams as Record<string, unknown>),
    [domain.generationParams],
  );
  const duration = useMemo(
    () => parseDuration(domain.generationParams as Record<string, unknown>),
    [domain.generationParams],
  );

  const hasPrompt = Boolean(prompt.trim());
  const hasStartFrame = Boolean(domain.startFrame);
  const isGenerating = controls?.isGenerating ?? false;
  const isSubmitting = controls?.isSubmitting ?? false;
  const isGenerationBusy = isGenerating || isSubmitting;

  // C8 guard: rapid Preview-storyboard double-clicks fire `onStoryboard`
  // multiple times because the upstream isSubmittingRef inside
  // useGenerationActions only flips AFTER the workspace-level prelude
  // (optimize -> session-create) completes. During that prelude, the button
  // looks enabled and a second click would silently re-charge credits.
  // Hold a short cooldown ref so each Preview click fires the handler at
  // most once per ~2s window. The ref is intentionally NOT in disabled
  // state to keep the button visually unchanged; the click is just dropped.
  const previewClickCooldownRef = useRef(false);
  // Track the cooldown timer so unmount during the window cleans it up
  // rather than leaving a pending callback against a destroyed ref. Defensive
  // for future changes — if the timer body ever sets React state, the leak
  // would surface as a "set state on unmounted component" warning.
  const previewCooldownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (previewCooldownTimerRef.current !== null) {
        window.clearTimeout(previewCooldownTimerRef.current);
        previewCooldownTimerRef.current = null;
      }
    };
  }, []);

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      storeActions.mergeGenerationParams({ aspect_ratio: value });
    },
    [storeActions],
  );

  const handleDurationChange = useCallback(
    (value: number) => {
      storeActions.mergeGenerationParams({ duration_s: value });
    },
    [storeActions],
  );

  const { aspectRatioOptions, durationOptions, schema } =
    useCapabilitiesClamping({
      activeTab: "video",
      selectedModel: domain.selectedModel,
      videoTier: domain.videoTier,
      renderModelId,
      aspectRatio,
      duration,
      setVideoTier: storeActions.setVideoTier,
      onAspectRatioChange: handleAspectRatioChange,
      onDurationChange: handleDurationChange,
    });
  const videoInputCapabilities = useVideoInputCapabilities(schema ?? null);

  const selectedDraftModel = useMemo(
    () =>
      VIDEO_DRAFT_MODELS.find((model) => model.id === domain.selectedModel) ??
      null,
    [domain.selectedModel],
  );
  const isDraftModelSelected = selectedDraftModel !== null;

  const creditCost = getVideoCost(
    selectedDraftModel?.id ?? renderModelId,
    duration,
  );
  const hasInsufficientCredits =
    typeof creditBalance === "number" && creditBalance < creditCost;
  const hasInsufficientPreviewCredits =
    typeof creditBalance === "number" && creditBalance < STORYBOARD_COST;
  const operationLabel = isDraftModelSelected
    ? `${selectedDraftModel?.label ?? "Draft"} preview`
    : "Video render";

  const previewDisabled =
    !controls?.onStoryboard ||
    isGenerationBusy ||
    (!hasPrompt && !hasStartFrame) ||
    hasInsufficientPreviewCredits;
  const generateDisabled = isDraftModelSelected
    ? !controls?.onDraft ||
      isGenerationBusy ||
      !hasPrompt ||
      hasInsufficientCredits
    : !controls?.onRender ||
      isGenerationBusy ||
      !hasPrompt ||
      hasInsufficientCredits;

  const trackGenerationStart = useCallback(
    (selectedModelId: string) => {
      void trackModelRecommendationEvent({
        event: "generation_started",
        ...(recommendationPromptId
          ? {
              recommendationId: recommendationPromptId,
              promptId: recommendationPromptId,
            }
          : {}),
        ...(recommendedModelId ? { recommendedModelId } : {}),
        selectedModelId,
        ...(recommendationMode ? { mode: recommendationMode } : {}),
        durationSeconds: duration,
        ...(typeof recommendationAgeMs === "number"
          ? {
              timeSinceRecommendationMs: Math.max(
                0,
                Math.round(recommendationAgeMs),
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
    ],
  );

  const handleGenerate = useCallback(() => {
    if (hasInsufficientCredits) {
      onInsufficientCredits?.(creditCost, operationLabel);
      return;
    }
    if (selectedDraftModel) {
      trackGenerationStart(selectedDraftModel.id);
      controls?.onDraft?.(selectedDraftModel.id);
    } else {
      trackGenerationStart(renderModelId);
      controls?.onRender?.(renderModelId);
    }
  }, [
    controls,
    creditCost,
    hasInsufficientCredits,
    onInsufficientCredits,
    operationLabel,
    renderModelId,
    selectedDraftModel,
    trackGenerationStart,
  ]);

  const formatDurationLabel = useCallback((v: number) => `${v}s`, []);

  return (
    <div
      className="mx-auto mt-3 flex w-fit flex-wrap items-center gap-1 rounded-2xl border border-white/[0.08] px-3 py-2"
      style={{
        backgroundColor: "rgba(26, 26, 31, 0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      data-testid="canvas-settings-row"
    >
      <div className="flex flex-wrap items-center gap-1">
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

        {videoInputCapabilities.supportsEndFrame ? (
          <EndFramePopover
            endFrame={domain.endFrame}
            onSetEndFrame={storeActions.setEndFrame}
            onClearEndFrame={storeActions.clearEndFrame}
            onUploadSidebarImage={onUploadSidebarImage}
            disabled={isGenerating}
          />
        ) : null}

        {videoInputCapabilities.supportsReferenceImages ? (
          <VideoReferencesPopover
            references={domain.videoReferenceImages}
            maxSlots={videoInputCapabilities.maxReferenceImages}
            onAddReference={storeActions.addVideoReference}
            onRemoveReference={storeActions.removeVideoReference}
            onUpdateReferenceType={storeActions.updateVideoReferenceType}
            onUploadSidebarImage={onUploadSidebarImage}
            disabled={isGenerating}
          />
        ) : null}

        {domain.extendVideo ? (
          <div className="inline-flex h-[30px] items-center gap-1 rounded-full border border-surface-2 bg-tool-nav-hover pl-2.5 pr-1 text-xs font-semibold text-foreground">
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1.2" y="2.2" width="6.4" height="6" rx="1" />
              <path d="M7.6 4.2 9.8 3v5L7.6 6.8" />
            </svg>
            Extending
            <button
              type="button"
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-tool-text-dim transition-colors hover:bg-tool-nav-active hover:text-foreground"
              onClick={() => storeActions.clearExtendVideo()}
              aria-label="Clear extend mode"
            >
              <X size={10} />
            </button>
          </div>
        ) : null}

        {/* Assets */}
        <BarBtn onClick={(e) => e.stopPropagation()}>Assets</BarBtn>

        {/* Aspect ratio dropdown */}
        <MiniDropdown
          value={aspectRatio}
          options={aspectRatioOptions}
          onChange={handleAspectRatioChange}
        />

        {/* Duration dropdown */}
        <MiniDropdown
          value={duration}
          options={durationOptions}
          onChange={handleDurationChange}
          formatLabel={formatDurationLabel}
        />

        {/* AI Enhance */}
        <BarBtn
          accent
          className="w-[68px] justify-center px-0"
          aria-label={isEnhancing ? "Enhancing prompt…" : "Enhance prompt"}
          title={isEnhancing ? "Enhancing…" : "Enhance"}
          // ISSUE-39: also gate on `hasPrompt`. The handler in
          // PromptCanvas.handleEnhance silently returns when the prompt is
          // empty, which would otherwise leave the user clicking a
          // visibly-active button with zero feedback.
          disabled={isEnhancing || !onEnhance || !hasPrompt}
          {...(onEnhance && !isEnhancing && hasPrompt
            ? {
                onClick: (event: React.MouseEvent) => {
                  event.stopPropagation();
                  onEnhance();
                },
              }
            : {})}
        >
          {isEnhancing ? (
            <svg
              className="animate-spin"
              width={14}
              height={14}
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="24 10"
              />
            </svg>
          ) : (
            <MagicWand size={14} />
          )}
        </BarBtn>
      </div>

      {/* Vertical divider between text controls and action buttons */}
      <div className="mx-1 h-5 w-px bg-white/[0.08]" aria-hidden="true" />

      <div className="flex flex-wrap items-center justify-end gap-1">
        {/* Preview button (secondary) */}
        <button
          type="button"
          data-testid="canvas-preview-button"
          className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-md text-tool-text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:text-tool-text-label"
          onClick={() => {
            if (hasInsufficientPreviewCredits) {
              onInsufficientCredits?.(STORYBOARD_COST, "Storyboard preview");
              return;
            }
            if (previewClickCooldownRef.current) {
              return;
            }
            previewClickCooldownRef.current = true;
            controls?.onStoryboard?.();
            previewCooldownTimerRef.current = window.setTimeout(() => {
              previewClickCooldownRef.current = false;
              previewCooldownTimerRef.current = null;
            }, PREVIEW_CLICK_COOLDOWN_MS);
          }}
          disabled={previewDisabled}
          aria-label={
            isSubmitting
              ? "Starting storyboard generation"
              : hasInsufficientPreviewCredits
                ? `Need ${STORYBOARD_COST} credits for preview — top up in billing`
                : `Preview storyboard ${STORYBOARD_COST} credits`
          }
          title={
            isSubmitting
              ? "Starting..."
              : hasInsufficientPreviewCredits
                ? `Need ${STORYBOARD_COST} credits`
                : `Preview · ${STORYBOARD_COST} cr`
          }
        >
          <Eye size={14} />
        </button>

        {/* Generate button (primary) */}
        <button
          type="button"
          data-testid="canvas-generate-button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-none bg-tool-btn-generate-bg text-tool-btn-generate-text transition-opacity hover:opacity-[0.9] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleGenerate}
          disabled={generateDisabled}
          aria-busy={isGenerationBusy}
          aria-label={
            isGenerationBusy
              ? "Starting generation"
              : hasInsufficientCredits
                ? `Need ${creditCost} credits — top up in billing`
                : `${isDraftModelSelected ? "Draft" : "Generate"} ${creditCost} credits`
          }
          title={
            isGenerationBusy
              ? "Starting..."
              : hasInsufficientCredits
                ? `Need ${creditCost} credits`
                : `${isDraftModelSelected ? "Draft" : "Generate"} · ${creditCost} cr`
          }
        >
          {isGenerationBusy ? (
            <svg
              className="animate-spin"
              width={16}
              height={16}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray="28 12"
              />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 1.25C8.35 1.25 8.66 1.48 8.76 1.82L10.04 6.02L14.2 7.28C14.55 7.39 14.78 7.7 14.78 8.05C14.78 8.4 14.55 8.71 14.2 8.82L10.04 10.08L8.76 14.28C8.66 14.62 8.35 14.85 8 14.85C7.65 14.85 7.34 14.62 7.24 14.28L5.96 10.08L1.8 8.82C1.45 8.71 1.22 8.4 1.22 8.05C1.22 7.7 1.45 7.39 1.8 7.28L5.96 6.02L7.24 1.82C7.34 1.48 7.65 1.25 8 1.25Z"
                fill="currentColor"
              />
              <circle cx="12.7" cy="3.2" r="1.05" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
