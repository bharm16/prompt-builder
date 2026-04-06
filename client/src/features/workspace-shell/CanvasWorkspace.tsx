import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CameraMotionModal } from "@/components/modals/CameraMotionModal";
import { VIDEO_DRAFT_MODEL } from "@/components/ToolSidebar/config/modelConfig";
import type { AssetSuggestion } from "@/features/assets/hooks/useTriggerAutocomplete";
import type { CameraPath } from "@/features/convergence/types";
import { sanitizeText } from "@/features/span-highlighting";
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from "@features/generation-controls";
import { useOptionalPromptHighlights } from "@/features/prompt-optimizer/context/PromptStateContext";
import { useWorkspaceSession } from "@/features/prompt-optimizer/context/WorkspaceSessionContext";
import { useGenerationsRuntime } from "@features/generations";
import type {
  Generation,
  GenerationsPanelProps,
  GenerationsPanelStateSnapshot,
} from "@features/generations/types";
import type {
  InlineSuggestion,
  SuggestionItem,
} from "@/features/prompt-optimizer/PromptCanvas/types";
import { trackModelRecommendationEvent } from "@/features/model-intelligence/api";
import { useModelSelectionRecommendation } from "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation";
import { useSidebarGenerationDomain } from "@/components/ToolSidebar/context";
import { GalleryPanel } from "@/features/prompt-optimizer/components/GalleryPanel";
import { GenerationPopover } from "@/features/prompt-optimizer/components/GenerationPopover";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { cn } from "@/utils/cn";
import { buildGalleryGenerationEntries } from "./utils/galleryGeneration";
import { CanvasTopBar } from "./components/CanvasTopBar";
import { CanvasPromptBar } from "./components/CanvasPromptBar";
import { ModelCornerSelector } from "./components/ModelCornerSelector";
import { CanvasHeroViewer } from "./components/CanvasHeroViewer";
import { NewSessionView } from "./components/NewSessionView";

interface CanvasWorkspaceProps {
  generationsPanelProps: GenerationsPanelProps;
  copied: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onCopy: () => void;
  onShare: () => void;
  onUndo: () => void;
  onRedo: () => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onTextSelection: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onEditorBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  autocompleteOpen: boolean;
  autocompleteSuggestions: AssetSuggestion[];
  autocompleteSelectedIndex: number;
  autocompletePosition: { top: number; left: number };
  autocompleteLoading: boolean;
  onAutocompleteSelect: (asset: AssetSuggestion) => void;
  onAutocompleteClose: () => void;
  onAutocompleteIndexChange: (index: number) => void;
  enableMLHighlighting: boolean;
  selectedSpanId: string | null;
  suggestionCount: number;
  suggestionsListRef: React.RefObject<HTMLDivElement>;
  inlineSuggestions: InlineSuggestion[];
  activeSuggestionIndex: number;
  onActiveSuggestionChange: (index: number) => void;
  interactionSourceRef: React.MutableRefObject<"keyboard" | "mouse" | "auto">;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onCloseInlinePopover: () => void;
  selectionLabel: string;
  onApplyActiveSuggestion: () => void;
  isInlineLoading: boolean;
  isInlineError: boolean;
  inlineErrorMessage: string;
  isInlineEmpty: boolean;
  customRequest: string;
  onCustomRequestChange: (value: string) => void;
  customRequestError: string;
  onCustomRequestErrorChange: (value: string) => void;
  onCustomRequestSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCustomRequestDisabled: boolean;
  isCustomLoading: boolean;
  responseMetadata?: Record<string, unknown> | null;
  onCopyAllDebug?: () => void;
  isBulkCopyLoading?: boolean;
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: SuggestionItem[];
  onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
  onReuseGeneration: (generation: Generation) => void;
  onToggleGenerationFavorite: (
    generationId: string,
    isFavorite: boolean,
  ) => void;
  onEnhance?: () => void;
  isEnhancing?: boolean;
}

const parseDurationSeconds = (
  generationParams: Record<string, unknown>,
): number => {
  const value = generationParams.duration_s;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 5;
};

const normalizePromptForComparison = (
  value: string | null | undefined,
): string => sanitizeText(typeof value === "string" ? value : "").trim();

export function CanvasWorkspace({
  generationsPanelProps,
  copied,
  canUndo,
  canRedo,
  onCopy,
  onShare,
  onUndo,
  onRedo,
  editorRef,
  onTextSelection,
  onHighlightClick,
  onHighlightMouseDown,
  onHighlightMouseEnter,
  onHighlightMouseLeave,
  onCopyEvent,
  onInput,
  onEditorKeyDown,
  onEditorBlur,
  autocompleteOpen,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  autocompletePosition,
  autocompleteLoading,
  onAutocompleteSelect,
  onAutocompleteClose,
  onAutocompleteIndexChange,
  enableMLHighlighting,
  selectedSpanId,
  suggestionCount,
  suggestionsListRef,
  inlineSuggestions,
  activeSuggestionIndex,
  onActiveSuggestionChange,
  interactionSourceRef,
  onSuggestionClick,
  onCloseInlinePopover,
  selectionLabel,
  onApplyActiveSuggestion,
  isInlineLoading,
  isInlineError,
  inlineErrorMessage,
  isInlineEmpty,
  customRequest,
  onCustomRequestChange,
  customRequestError,
  onCustomRequestErrorChange,
  onCustomRequestSubmit,
  isCustomRequestDisabled,
  isCustomLoading,
  responseMetadata = null,
  onCopyAllDebug,
  isBulkCopyLoading = false,
  showI2VLockIndicator,
  resolvedI2VReason,
  i2vMotionAlternatives,
  onLockedAlternativeClick,
  onReuseGeneration,
  onToggleGenerationFavorite,
  onEnhance,
  isEnhancing = false,
}: CanvasWorkspaceProps): React.ReactElement {
  const storeActions = useGenerationControlsStoreActions();
  const { domain } = useGenerationControlsStoreState();
  const promptHighlights = useOptionalPromptHighlights();
  const { hasActiveContinuityShot, currentShot, updateShot } =
    useWorkspaceSession();
  const generationDomain = useSidebarGenerationDomain();
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const prompt = generationsPanelProps.prompt;
  const durationSeconds = parseDurationSeconds(
    domain.generationParams as Record<string, unknown>,
  );

  const {
    recommendationMode,
    modelRecommendation,
    recommendedModelId,
    efficientModelId,
    renderModelOptions,
    renderModelId,
    recommendationAgeMs,
  } = useModelSelectionRecommendation({
    prompt,
    activeTab: "video",
    keyframesCount: domain.startFrame ? 1 : 0,
    durationSeconds,
    selectedModel: domain.selectedModel,
    videoTier: domain.videoTier,
    promptHighlights: promptHighlights?.initialHighlights ?? null,
  });

  const handleModelChange = useCallback(
    (modelId: string): void => {
      const nextTier = modelId === VIDEO_DRAFT_MODEL.id ? "draft" : "render";
      if (modelId === domain.selectedModel) return;

      void trackModelRecommendationEvent({
        event: "model_selected",
        recommendationId: modelRecommendation?.promptId,
        promptId: modelRecommendation?.promptId,
        recommendedModelId,
        selectedModelId: modelId,
        mode: recommendationMode,
        durationSeconds,
        ...(typeof recommendationAgeMs === "number"
          ? {
              timeSinceRecommendationMs: Math.max(
                0,
                Math.round(recommendationAgeMs),
              ),
            }
          : {}),
      });

      storeActions.setSelectedModel(modelId);
      if (nextTier !== domain.videoTier) storeActions.setVideoTier(nextTier);

      if (
        hasActiveContinuityShot &&
        currentShot &&
        currentShot.modelId !== modelId
      ) {
        void updateShot(currentShot.id, { modelId });
      }
    },
    [
      currentShot,
      domain.selectedModel,
      domain.videoTier,
      durationSeconds,
      hasActiveContinuityShot,
      modelRecommendation?.promptId,
      recommendationAgeMs,
      recommendationMode,
      recommendedModelId,
      storeActions,
      updateShot,
    ],
  );

  const onStateSnapshotProp = generationsPanelProps.onStateSnapshot;
  const handleSnapshot = useCallback(
    (nextSnapshot: GenerationsPanelStateSnapshot) => {
      onStateSnapshotProp?.(nextSnapshot);
    },
    [onStateSnapshotProp],
  );

  const generationsRuntime = useGenerationsRuntime({
    ...generationsPanelProps,
    presentation: "hero",
    onStateSnapshot: handleSnapshot,
  });

  useEffect(() => {
    setViewingId(null);
  }, [generationsPanelProps.promptVersionId]);

  const heroGeneration = generationsRuntime.heroGeneration;
  const displayHeroGeneration = useMemo(() => {
    if (heroGeneration?.status !== "failed") {
      return heroGeneration;
    }

    const currentPrompt = normalizePromptForComparison(
      generationsPanelProps.prompt,
    );
    const failedPrompt = normalizePromptForComparison(heroGeneration.prompt);
    return currentPrompt === failedPrompt ? heroGeneration : null;
  }, [generationsPanelProps.prompt, heroGeneration]);

  const galleryEntries = useMemo(() => {
    // When runtimeGenerations is empty (e.g., after po:workspace-reset), skip
    // version-based entries to prevent stale gallery items from a prior session
    // remaining visible during the transition to a new draft.
    const versions =
      generationsRuntime.generations.length === 0
        ? []
        : generationsPanelProps.versions;
    return buildGalleryGenerationEntries({
      versions,
      runtimeGenerations: generationsRuntime.generations,
    });
  }, [generationsPanelProps.versions, generationsRuntime.generations]);

  const galleryGenerations = useMemo(
    () => galleryEntries.map((entry) => entry.gallery),
    [galleryEntries],
  );

  const generationLookup = useMemo(() => {
    const lookup = new Map<string, Generation>();
    for (const entry of galleryEntries) {
      lookup.set(entry.generation.id, entry.generation);
    }
    return lookup;
  }, [galleryEntries]);

  useEffect(() => {
    if (!viewingId) return;
    if (generationLookup.has(viewingId)) return;
    setViewingId(null);
  }, [generationLookup, viewingId]);

  const isEmptySession = useMemo(() => {
    const hasGenerations =
      galleryEntries.length > 0 || displayHeroGeneration !== null;
    const hasStartFrame = Boolean(domain.startFrame);
    const hasHydratedSessionPrompt =
      enableMLHighlighting && prompt.trim().length > 0;
    return !hasGenerations && !hasStartFrame && !hasHydratedSessionPrompt;
  }, [
    enableMLHighlighting,
    galleryEntries.length,
    displayHeroGeneration,
    domain.startFrame,
    prompt,
  ]);

  const galleryOpen = true;
  const { shouldRender: shouldRenderEmptyChrome, phase: emptyChromePhase } =
    useAnimatedPresence(isEmptySession, { exitMs: 220 });
  const { shouldRender: shouldRenderGallery, phase: galleryPhase } =
    useAnimatedPresence(!isEmptySession && galleryOpen, { exitMs: 220 });
  const { shouldRender: shouldRenderHero, phase: heroPhase } =
    useAnimatedPresence(!isEmptySession && Boolean(displayHeroGeneration), {
      exitMs: 240,
    });

  const handleSelectGeneration = useCallback((generationId: string): void => {
    setViewingId(generationId);
  }, []);

  const handleCloseGallery = useCallback((): void => {
    // Gallery rail is intentionally persistent in canvas mode.
  }, []);

  const handleReuse = useCallback(
    (generationId: string): void => {
      const generation = generationLookup.get(generationId);
      if (!generation) return;
      onReuseGeneration(generation);
      setViewingId(null);
    },
    [generationLookup, onReuseGeneration],
  );
  const handleOpenMotion = useCallback((): void => {
    if (!domain.startFrame) return;
    setShowCameraMotionModal(true);
  }, [domain.startFrame]);
  const handleCameraMotionSelect = useCallback(
    (cameraPath: CameraPath): void => {
      storeActions.setCameraMotion(cameraPath);
      setShowCameraMotionModal(false);
    },
    [storeActions],
  );
  const promptBarProps = {
    editorRef,
    prompt,
    onTextSelection,
    onHighlightClick,
    onHighlightMouseDown,
    onHighlightMouseEnter,
    onHighlightMouseLeave,
    onCopyEvent,
    onInput,
    onEditorKeyDown,
    onEditorBlur,
    autocompleteOpen,
    autocompleteSuggestions,
    autocompleteSelectedIndex,
    autocompletePosition,
    autocompleteLoading,
    onAutocompleteSelect,
    onAutocompleteClose,
    onAutocompleteIndexChange,
    selectedSpanId,
    suggestionCount,
    suggestionsListRef,
    inlineSuggestions,
    activeSuggestionIndex,
    onActiveSuggestionChange,
    interactionSourceRef,
    onSuggestionClick,
    onCloseInlinePopover,
    selectionLabel,
    onApplyActiveSuggestion,
    isInlineLoading,
    isInlineError,
    inlineErrorMessage,
    isInlineEmpty,
    customRequest,
    onCustomRequestChange,
    customRequestError,
    onCustomRequestErrorChange,
    onCustomRequestSubmit,
    isCustomRequestDisabled,
    isCustomLoading,
    responseMetadata: responseMetadata ?? null,
    ...(onCopyAllDebug ? { onCopyAllDebug } : {}),
    ...(isBulkCopyLoading ? { isBulkCopyLoading } : {}),
    showI2VLockIndicator,
    resolvedI2VReason,
    i2vMotionAlternatives,
    onLockedAlternativeClick,
    renderModelId,
    ...(recommendedModelId ? { recommendedModelId } : {}),
    ...(modelRecommendation?.promptId
      ? { recommendationPromptId: modelRecommendation.promptId }
      : {}),
    ...(recommendationMode ? { recommendationMode } : {}),
    ...(typeof recommendationAgeMs === "number" ? { recommendationAgeMs } : {}),
    onOpenMotion: handleOpenMotion,
    ...(generationDomain?.onStartFrameUpload
      ? { onStartFrameUpload: generationDomain.onStartFrameUpload }
      : {}),
    ...(generationDomain?.onUploadSidebarImage
      ? { onUploadSidebarImage: generationDomain.onUploadSidebarImage }
      : {}),
    ...(onEnhance ? { onEnhance } : {}),
    isEnhancing,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-tool-surface-deep">
      <CanvasTopBar />

      <div className="flex min-h-0 flex-1 overflow-hidden px-3">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-8 pb-0">
          {shouldRenderEmptyChrome ? (
            <div
              className="motion-presence-panel absolute inset-0"
              data-motion-state={emptyChromePhase}
            >
              <NewSessionView />
            </div>
          ) : null}

          <ModelCornerSelector
            renderModelOptions={renderModelOptions}
            renderModelId={renderModelId}
            modelRecommendation={modelRecommendation}
            recommendedModelId={recommendedModelId}
            efficientModelId={efficientModelId}
            onModelChange={handleModelChange}
            className={cn(
              "left-5 transition-[bottom,transform] duration-[220ms] [transition-timing-function:var(--motion-ease-emphasized)]",
              isEmptySession ? "bottom-4" : "bottom-0",
            )}
          />

          <div
            className={cn(
              "relative flex min-h-0 flex-1 flex-col overflow-hidden transition-[padding] duration-[400ms] [transition-timing-function:var(--motion-ease-emphasized)]",
              isEmptySession ? "justify-center" : "pt-8",
              !isEmptySession && !displayHeroGeneration ? "justify-center" : "",
            )}
          >
            {shouldRenderHero ? (
              <div
                className="motion-presence-panel mb-5"
                data-motion-state={heroPhase}
              >
                <CanvasHeroViewer
                  generation={displayHeroGeneration}
                  onCancel={generationsRuntime.handleCancel}
                />
              </div>
            ) : null}

            <div className={cn(
              "relative z-10 flex w-full justify-center",
              !displayHeroGeneration && "mx-auto max-w-[720px]",
            )}>
              <CanvasPromptBar
                {...promptBarProps}
                layoutMode={isEmptySession ? "empty" : "active"}
              />
            </div>
          </div>
        </div>

        {shouldRenderGallery ? (
          <div
            className="motion-presence-panel"
            data-motion-state={galleryPhase}
          >
            <GalleryPanel
              generations={galleryGenerations}
              activeGenerationId={viewingId}
              onSelectGeneration={handleSelectGeneration}
              onClose={handleCloseGallery}
            />
          </div>
        ) : null}
      </div>

      {viewingId ? (
        <GenerationPopover
          generations={galleryGenerations}
          activeId={viewingId}
          onChange={setViewingId}
          onClose={() => setViewingId(null)}
          onReuse={handleReuse}
          onToggleFavorite={onToggleGenerationFavorite}
        />
      ) : null}

      {domain.startFrame ? (
        <CameraMotionModal
          isOpen={showCameraMotionModal}
          onClose={() => setShowCameraMotionModal(false)}
          imageUrl={domain.startFrame.url}
          imageStoragePath={domain.startFrame.storagePath ?? null}
          imageAssetId={domain.startFrame.assetId ?? null}
          initialSelection={domain.cameraMotion}
          onSelect={handleCameraMotionSelect}
        />
      ) : null}
    </div>
  );
}
