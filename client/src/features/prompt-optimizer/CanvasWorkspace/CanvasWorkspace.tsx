import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import { VIDEO_DRAFT_MODEL } from '@/components/ToolSidebar/config/modelConfig';
import type { KeyframeTile } from '@/components/ToolSidebar/types';
import type { AssetSuggestion } from '@/features/assets/hooks/useTriggerAutocomplete';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useOptionalPromptHighlights } from '@/features/prompt-optimizer/context/PromptStateContext';
import { useWorkspaceSession } from '@/features/prompt-optimizer/context/WorkspaceSessionContext';
import { GenerationsPanel, useGenerationsRuntime } from '@/features/prompt-optimizer/GenerationsPanel';
import type {
  Generation,
  GenerationsPanelProps,
  GenerationsPanelStateSnapshot,
} from '@/features/prompt-optimizer/GenerationsPanel/types';
import type {
  InlineSuggestion,
  SuggestionItem,
} from '@/features/prompt-optimizer/PromptCanvas/types';
import { trackModelRecommendationEvent } from '@/features/model-intelligence/api';
import { useModelSelectionRecommendation } from '@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation';
import { useSidebarGenerationDomain } from '@/components/ToolSidebar/context';
import type { PromptVersionEntry } from '@/hooks/types';
import { CanvasTopBar } from './components/CanvasTopBar';
import { CanvasGenerationStrip } from './components/CanvasGenerationStrip';
import { CanvasPromptBar } from './components/CanvasPromptBar';
import { StoryboardHeroView } from './components/StoryboardHeroView';
import { ModelCornerSelector } from './components/ModelCornerSelector';

interface VersionsPanelPropsBase {
  versions: PromptVersionEntry[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onCreateVersion: () => void;
}

interface CanvasWorkspaceProps {
  versionsPanelProps: VersionsPanelPropsBase;
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
  interactionSourceRef: React.MutableRefObject<'keyboard' | 'mouse' | 'auto'>;
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
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: SuggestionItem[];
  onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
}

const parseDurationSeconds = (generationParams: Record<string, unknown>): number => {
  const value = generationParams.duration_s;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 5;
};

const resolveGenerationTimestamp = (generation: Generation): number =>
  generation.completedAt ?? generation.createdAt ?? 0;

export function CanvasWorkspace({
  versionsPanelProps,
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
  showI2VLockIndicator,
  resolvedI2VReason,
  i2vMotionAlternatives,
  onLockedAlternativeClick,
}: CanvasWorkspaceProps): React.ReactElement {
  const storeActions = useGenerationControlsStoreActions();
  const { domain } = useGenerationControlsStoreState();
  const promptHighlights = useOptionalPromptHighlights();
  const { hasActiveContinuityShot, currentShot, updateShot } = useWorkspaceSession();
  const generationDomain = useSidebarGenerationDomain();
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);
  const previousGenerationStatusRef = useRef<Map<string, Generation['status']>>(new Map());

  const prompt = generationsPanelProps.prompt;
  const durationSeconds = parseDurationSeconds(
    domain.generationParams as Record<string, unknown>
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
    activeTab: 'video',
    keyframesCount: domain.startFrame ? 1 : 0,
    durationSeconds,
    selectedModel: domain.selectedModel,
    videoTier: domain.videoTier,
    promptHighlights: promptHighlights?.initialHighlights ?? null,
  });

  const handleModelChange = useCallback(
    (modelId: string): void => {
      const nextTier = modelId === VIDEO_DRAFT_MODEL.id ? 'draft' : 'render';
      if (modelId === domain.selectedModel) return;

      void trackModelRecommendationEvent({
        event: 'model_selected',
        recommendationId: modelRecommendation?.promptId,
        promptId: modelRecommendation?.promptId,
        recommendedModelId,
        selectedModelId: modelId,
        mode: recommendationMode,
        durationSeconds,
        ...(typeof recommendationAgeMs === 'number'
          ? { timeSinceRecommendationMs: Math.max(0, Math.round(recommendationAgeMs)) }
          : {}),
      });

      storeActions.setSelectedModel(modelId);
      if (nextTier !== domain.videoTier) storeActions.setVideoTier(nextTier);

      if (hasActiveContinuityShot && currentShot && currentShot.modelId !== modelId) {
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
    ]
  );

  const handleSnapshot = useCallback(
    (nextSnapshot: GenerationsPanelStateSnapshot) => {
      generationsPanelProps.onStateSnapshot?.(nextSnapshot);
    },
    [generationsPanelProps]
  );

  const generationsRuntime = useGenerationsRuntime({
    ...generationsPanelProps,
    presentation: 'hero',
    onStateSnapshot: handleSnapshot,
    heroOverrideGenerationId: selectedGenerationId,
  });

  const handleSelectGeneration = useCallback(
    (generationId: string): void => {
      setSelectedGenerationId(generationId);
      generationsRuntime.setActiveGeneration(generationId);
    },
    [generationsRuntime]
  );

  useEffect(() => {
    setSelectedGenerationId(null);
    previousGenerationStatusRef.current = new Map();
  }, [generationsPanelProps.promptVersionId]);

  const orderedGenerations = useMemo(
    () =>
      [...generationsRuntime.generations].sort(
        (left, right) => resolveGenerationTimestamp(right) - resolveGenerationTimestamp(left)
      ),
    [generationsRuntime.generations]
  );

  useEffect(() => {
    if (orderedGenerations.length === 0) {
      previousGenerationStatusRef.current = new Map();
      if (selectedGenerationId !== null) {
        setSelectedGenerationId(null);
      }
      return;
    }

    const previousStatuses = previousGenerationStatusRef.current;
    const nextStatuses = new Map<string, Generation['status']>();
    const completedTransitions: Generation[] = [];

    for (const generation of orderedGenerations) {
      const previousStatus = previousStatuses.get(generation.id);
      if (generation.status === 'completed' && previousStatus !== 'completed') {
        completedTransitions.push(generation);
      }
      nextStatuses.set(generation.id, generation.status);
    }

    previousGenerationStatusRef.current = nextStatuses;

    if (completedTransitions.length > 0) {
      const latestCompleted = [...completedTransitions].sort(
        (left, right) => resolveGenerationTimestamp(right) - resolveGenerationTimestamp(left)
      )[0];
      if (latestCompleted && latestCompleted.id !== selectedGenerationId) {
        setSelectedGenerationId(latestCompleted.id);
      }
      return;
    }

    if (
      selectedGenerationId &&
      !orderedGenerations.some((generation) => generation.id === selectedGenerationId)
    ) {
      setSelectedGenerationId(null);
    }
  }, [orderedGenerations, selectedGenerationId]);

  const selectedGeneration = useMemo(() => {
    if (orderedGenerations.length === 0) return null;

    if (selectedGenerationId) {
      const selected = orderedGenerations.find(
        (generation) => generation.id === selectedGenerationId
      );
      if (selected) return selected;
    }

    const latestCompleted = orderedGenerations.find(
      (generation) => generation.status === 'completed'
    );
    if (latestCompleted) return latestCompleted;

    return orderedGenerations[0] ?? null;
  }, [orderedGenerations, selectedGenerationId]);

  const handleUseStoryboardFrame = useCallback(
    (frame: KeyframeTile) => {
      storeActions.setStartFrame(frame);
    },
    [storeActions]
  );

  const actionLabels = ['Reuse', 'Extend', 'Copy prompt', 'Share', 'Download'];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0D0E12]">
      <CanvasTopBar
        versions={versionsPanelProps.versions}
        selectedVersionId={versionsPanelProps.selectedVersionId}
        onSelectVersion={versionsPanelProps.onSelectVersion}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-24">
        <CanvasGenerationStrip
          generations={generationsRuntime.generations}
          selectedGenerationId={selectedGenerationId}
          onSelectGeneration={handleSelectGeneration}
        />

        <ModelCornerSelector
          renderModelOptions={renderModelOptions}
          renderModelId={renderModelId}
          modelRecommendation={modelRecommendation}
          recommendedModelId={recommendedModelId}
          efficientModelId={efficientModelId}
          onModelChange={handleModelChange}
          className="bottom-6 left-5"
        />

        <div className="relative overflow-hidden rounded-2xl">
          <div className="relative mx-auto w-[55%]">
            {selectedGeneration?.mediaType === 'image-sequence' ? (
              <StoryboardHeroView
                generation={selectedGeneration}
                onUseAsStartFrame={handleUseStoryboardFrame}
              />
            ) : (
              <GenerationsPanel
                {...generationsPanelProps}
                presentation="hero"
                runtime={generationsRuntime}
                heroOverrideGenerationId={selectedGenerationId}
                className="h-auto"
              />
            )}
          </div>
        </div>

        <div className="relative mx-auto -top-4 w-[55%] px-1 pb-1 pt-0">
          <div className="flex gap-4">
            {actionLabels.map((label) => (
              <button
                key={label}
                type="button"
                className="border-none bg-transparent p-0 text-xs text-[#3A3E4C] transition-colors hover:text-[#8B92A5]"
                onClick={() => {
                  if (label === 'Copy prompt') onCopy();
                  else if (label === 'Share') onShare();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <CanvasPromptBar
          editorRef={editorRef}
          prompt={prompt}
          onTextSelection={onTextSelection}
          onHighlightClick={onHighlightClick}
          onHighlightMouseDown={onHighlightMouseDown}
          onHighlightMouseEnter={onHighlightMouseEnter}
          onHighlightMouseLeave={onHighlightMouseLeave}
          onCopyEvent={onCopyEvent}
          onInput={onInput}
          onEditorKeyDown={onEditorKeyDown}
          onEditorBlur={onEditorBlur}
          autocompleteOpen={autocompleteOpen}
          autocompleteSuggestions={autocompleteSuggestions}
          autocompleteSelectedIndex={autocompleteSelectedIndex}
          autocompletePosition={autocompletePosition}
          autocompleteLoading={autocompleteLoading}
          onAutocompleteSelect={onAutocompleteSelect}
          onAutocompleteClose={onAutocompleteClose}
          onAutocompleteIndexChange={onAutocompleteIndexChange}
          selectedSpanId={selectedSpanId}
          suggestionCount={suggestionCount}
          suggestionsListRef={suggestionsListRef}
          inlineSuggestions={inlineSuggestions}
          activeSuggestionIndex={activeSuggestionIndex}
          onActiveSuggestionChange={onActiveSuggestionChange}
          interactionSourceRef={interactionSourceRef}
          onSuggestionClick={onSuggestionClick}
          onCloseInlinePopover={onCloseInlinePopover}
          selectionLabel={selectionLabel}
          onApplyActiveSuggestion={onApplyActiveSuggestion}
          isInlineLoading={isInlineLoading}
          isInlineError={isInlineError}
          inlineErrorMessage={inlineErrorMessage}
          isInlineEmpty={isInlineEmpty}
          customRequest={customRequest}
          onCustomRequestChange={onCustomRequestChange}
          customRequestError={customRequestError}
          onCustomRequestErrorChange={onCustomRequestErrorChange}
          onCustomRequestSubmit={onCustomRequestSubmit}
          isCustomRequestDisabled={isCustomRequestDisabled}
          isCustomLoading={isCustomLoading}
          showI2VLockIndicator={showI2VLockIndicator}
          resolvedI2VReason={resolvedI2VReason}
          i2vMotionAlternatives={i2vMotionAlternatives}
          onLockedAlternativeClick={onLockedAlternativeClick}
          renderModelId={renderModelId}
          {...(recommendedModelId ? { recommendedModelId } : {})}
          {...(modelRecommendation?.promptId
            ? { recommendationPromptId: modelRecommendation.promptId }
            : {})}
          {...(recommendationMode ? { recommendationMode } : {})}
          {...(typeof recommendationAgeMs === 'number'
            ? { recommendationAgeMs }
            : {})}
          onOpenMotion={() => {
            if (!domain.startFrame) return;
            setShowCameraMotionModal(true);
          }}
          {...(generationDomain?.onStartFrameUpload
            ? { onStartFrameUpload: generationDomain.onStartFrameUpload }
            : {})}
        />
      </div>

      {domain.startFrame ? (
        <CameraMotionModal
          isOpen={showCameraMotionModal}
          onClose={() => setShowCameraMotionModal(false)}
          imageUrl={domain.startFrame.url}
          imageStoragePath={domain.startFrame.storagePath ?? null}
          imageAssetId={domain.startFrame.assetId ?? null}
          initialSelection={domain.cameraMotion}
          onSelect={(cameraPath) => {
            storeActions.setCameraMotion(cameraPath);
            setShowCameraMotionModal(false);
          }}
        />
      ) : null}
    </div>
  );
}
