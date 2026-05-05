import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CameraMotionModal } from "@/components/modals/CameraMotionModal";
import { VIDEO_DRAFT_MODEL } from "@/components/ToolSidebar/config/modelConfig";
import type { AssetSuggestion } from "@/features/assets/hooks/useTriggerAutocomplete";
import type { CameraPath } from "@/features/convergence/types";
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
import { GenerationPopover } from "@/features/prompt-optimizer/components/GenerationPopover";
import { cn } from "@/utils/cn";
import { buildGalleryGenerationEntries } from "./utils/galleryGeneration";
import {
  computeWorkspaceMoment,
  workspaceMomentClass,
} from "./utils/computeWorkspaceMoment";
import { groupShots } from "./utils/groupShots";
import { useFeaturedTile } from "./hooks/useFeaturedTile";
import { useWorkspaceKeyboardShortcuts } from "./hooks/useWorkspaceKeyboardShortcuts";
import { ShotRow } from "./components/ShotRow";
import { ShotDivider } from "./components/ShotDivider";
import { ModelCornerSelector } from "./components/ModelCornerSelector";
import { TileStateAnnouncer } from "./components/TileStateAnnouncer";
import { WorkspaceTopBar } from "./components/WorkspaceTopBar";
import { CanvasPromptBar } from "./components/CanvasPromptBar";
import { CanvasSettingsRow } from "./components/CanvasSettingsRow";
import type { PromptEditorSurfaceProps } from "./components/PromptEditorSurface";
import { TuneDrawer } from "./components/TuneDrawer";
import { CostPreview } from "./components/CostPreview";
import type { TuneChipId } from "./utils/tuneChips";
import { applyTuneChips } from "./utils/tuneChips";
import { estimateShotCost } from "./utils/estimateShotCost";

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

export function CanvasWorkspace({
  generationsPanelProps,
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
  // Generation domain provides the upload handlers wired through to
  // CanvasSettingsRow's start-frame / video-reference popovers. Null when
  // SidebarDataContextProvider isn't mounted (tests, isolated stories).
  const generationDomain = useSidebarGenerationDomain();
  useWorkspaceKeyboardShortcuts();
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [tuneOpen, setTuneOpen] = useState<boolean>(false);
  // Phase 3 baseline: selected chips are tracked in state but not yet
  // appended to the prompt at submit time. Wiring the suffix into the
  // submit flow requires lifting the submit handler out of CanvasSettingsRow
  // (currently unchanged from legacy). Tracked as a Phase 3.5 follow-up.
  const [selectedChipIds, setSelectedChipIds] = useState<
    ReadonlyArray<TuneChipId>
  >([]);
  void applyTuneChips;

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

  const shotInputGenerations = useMemo(
    () => galleryEntries.map((entry) => entry.generation),
    [galleryEntries],
  );
  const shots = useMemo(
    () => groupShots(shotInputGenerations),
    [shotInputGenerations],
  );
  const featuredTile = useFeaturedTile({
    shots,
    heroGeneration: heroGeneration ?? null,
    currentPrompt: prompt,
  });

  useEffect(() => {
    if (!viewingId) return;
    if (generationLookup.has(viewingId)) return;
    setViewingId(null);
  }, [generationLookup, viewingId]);

  const handleSelectGeneration = useCallback((generationId: string): void => {
    setViewingId(generationId);
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
  const handleCameraMotionSelect = useCallback(
    (cameraPath: CameraPath): void => {
      storeActions.setCameraMotion(cameraPath);
      setShowCameraMotionModal(false);
    },
    [storeActions],
  );

  // Opens the camera-motion modal from the start-frame popover. Guarded on
  // domain.startFrame so the modal mount (which dereferences startFrame.url)
  // never sees a null start frame.
  const handleOpenMotion = useCallback((): void => {
    if (!domain.startFrame) return;
    setShowCameraMotionModal(true);
  }, [domain.startFrame]);

  const promptIsEmpty = prompt.trim().length === 0;
  const activeShotStatuses = useMemo<ReadonlyArray<Generation["status"]>>(
    () => shots[0]?.tiles.map((tile) => tile.status) ?? [],
    [shots],
  );
  const moment = computeWorkspaceMoment({
    galleryEntriesCount: galleryEntries.length,
    activeShotStatuses,
    promptIsEmpty,
    tuneOpen,
    promptFocused: false, // Phase 3 wires this
  });

  const surfaceProps: PromptEditorSurfaceProps = {
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
    ...(typeof isBulkCopyLoading === "boolean" ? { isBulkCopyLoading } : {}),
    showI2VLockIndicator,
    resolvedI2VReason,
    i2vMotionAlternatives,
    onLockedAlternativeClick,
  };

  const estimatedCost = useMemo(
    () =>
      estimateShotCost({
        modelId: domain.selectedModel,
        durationSeconds,
        variantCount: 4, // Phase 3 baseline; spec says "render four variants" by default
      }),
    [domain.selectedModel, durationSeconds],
  );

  const tuneSlot = tuneOpen ? (
    <TuneDrawer
      selectedChipIds={selectedChipIds}
      onToggleChip={(id) =>
        setSelectedChipIds((prev) =>
          prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
        )
      }
      onClose={() => setTuneOpen(false)}
    />
  ) : null;

  const chromeSlot = (
    <div className="border-t border-tool-rail-border">
      <CanvasSettingsRow
        prompt={prompt}
        renderModelId={renderModelId}
        {...(recommendedModelId ? { recommendedModelId } : {})}
        {...(modelRecommendation?.promptId
          ? { recommendationPromptId: modelRecommendation.promptId }
          : {})}
        {...(recommendationMode ? { recommendationMode } : {})}
        {...(typeof recommendationAgeMs === "number"
          ? { recommendationAgeMs }
          : {})}
        onOpenMotion={handleOpenMotion}
        {...(generationDomain?.onStartFrameUpload
          ? { onStartFrameUpload: generationDomain.onStartFrameUpload }
          : {})}
        {...(generationDomain?.onUploadSidebarImage
          ? { onUploadSidebarImage: generationDomain.onUploadSidebarImage }
          : {})}
        {...(onEnhance ? { onEnhance } : {})}
        isEnhancing={isEnhancing}
      />
      <div className="flex items-center justify-end gap-3 px-4 py-2">
        <button
          type="button"
          aria-pressed={tuneOpen}
          className="rounded-md border border-tool-rail-border px-2 py-1 text-[11px] font-medium text-tool-text-dim hover:text-foreground"
          onClick={() => setTuneOpen((open) => !open)}
        >
          Tune{selectedChipIds.length > 0 ? ` · ${selectedChipIds.length}` : ""}
        </button>
        <CostPreview cost={estimatedCost} />
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "grid h-full grid-rows-[var(--workspace-topbar-h)_1fr] [background:var(--tool-canvas-bg)] text-foreground overflow-hidden",
        workspaceMomentClass(moment),
      )}
    >
      <WorkspaceTopBar />
      <div className="grid min-h-0 grid-cols-[var(--tool-rail-width)_1fr]">
        {/*
          ToolSidebar already mounts elsewhere in the app shell. The
          workspace shell does NOT render the rail itself. Leave this column
          empty for now; the rail keeps mounting at its existing parent and
          visually overlaps the empty column. The rail mount can be moved
          into this column in a future polish pass if desired.
        */}
        <div aria-hidden="true" />
        <div className="relative min-h-0 overflow-y-auto px-7 pb-[140px] scroll-smooth">
          <TileStateAnnouncer shots={shots} />
          <ModelCornerSelector
            renderModelOptions={renderModelOptions}
            renderModelId={renderModelId}
            modelRecommendation={modelRecommendation}
            recommendedModelId={recommendedModelId}
            efficientModelId={efficientModelId}
            onModelChange={handleModelChange}
            className="absolute right-5 top-3"
          />

          {moment === "empty" ? (
            <EmptyHero />
          ) : (
            <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
              {shots.map((shot, idx) => (
                <React.Fragment key={shot.id}>
                  <ShotRow
                    shot={shot}
                    layout={idx === 0 ? "featured" : "compact"}
                    featuredTileId={
                      idx === 0 ? (featuredTile?.id ?? null) : null
                    }
                    onSelectTile={handleSelectGeneration}
                    onRetryTile={(generationId) => {
                      const target = shot.tiles.find(
                        (tile) => tile.id === generationId,
                      );
                      if (target) generationsRuntime.handleRetry(target);
                    }}
                  />
                  {idx < shots.length - 1 && <ShotDivider />}
                </React.Fragment>
              ))}
            </div>
          )}

          <CanvasPromptBar
            moment={moment}
            surfaceProps={surfaceProps}
            tuneSlot={tuneSlot}
            chromeSlot={chromeSlot}
            onContinueScene={(fromGenerationId) => {
              // Phase 2 baseline: log + acknowledge the event. Real
              // StartFramePopover seeding (last-frame extraction from video
              // metadata) is Phase 2.5.
              void fromGenerationId;
              // TODO Phase 2.5: resolve fromGenerationId → tile, extract
              // last-frame URL, call storeActions.setStartFrame(...) with
              // the resolved asset.
            }}
          />
        </div>
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

const STARTER_CHIPS = [
  "A neon-lit cyberpunk alley at night",
  "Slow-motion ink drop in clear water",
  "Drone shot over autumn forest at sunrise",
  "A dancer mid-leap in a sunlit studio",
] as const;

function EmptyHero(): React.ReactElement {
  // Phase 1: chips are visual stubs - clicking does nothing yet. Future
  // phases will wire chip clicks into the prompt setter.
  return (
    <div className="mx-auto flex min-h-[calc(100vh-var(--workspace-topbar-h)-240px)] max-w-[640px] flex-col items-center justify-center gap-[18px] text-center">
      <h1 className="text-[28px] font-medium tracking-[-0.01em]">
        What are you making?
      </h1>
      <p className="m-0 max-w-[460px] text-tool-text-subdued">
        Describe a shot. Pick a model. We&apos;ll render four variants.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {STARTER_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="rounded-full border border-tool-rail-border bg-tool-surface-card px-3 py-1 text-xs text-tool-text-dim hover:text-foreground"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
