import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import { VIDEO_DRAFT_MODEL } from '@/components/ToolSidebar/config/modelConfig';
import type { AssetSuggestion } from '@/features/assets/hooks/useTriggerAutocomplete';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useOptionalPromptHighlights } from '@/features/prompt-optimizer/context/PromptStateContext';
import { useWorkspaceSession } from '@/features/prompt-optimizer/context/WorkspaceSessionContext';
import { useGenerationsRuntime } from '@/features/prompt-optimizer/GenerationsPanel';
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
import {
  useSidebarGenerationDomain,
  useSidebarWorkspaceDomain,
} from '@/components/ToolSidebar/context';
import { GalleryPanel } from '@/features/prompt-optimizer/components/GalleryPanel';
import { GenerationPopover } from '@/features/prompt-optimizer/components/GenerationPopover';
import { buildGalleryGenerationEntries } from './utils/galleryGeneration';
import { CanvasTopBar } from './components/CanvasTopBar';
import { CanvasPromptBar } from './components/CanvasPromptBar';
import { ModelCornerSelector } from './components/ModelCornerSelector';
import { CanvasHeroViewer } from './components/CanvasHeroViewer';
import { NewSessionView } from './components/NewSessionView';

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
  onReuseGeneration: (generation: Generation) => void;
  onToggleGenerationFavorite: (generationId: string, isFavorite: boolean) => void;
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
  onReuseGeneration,
  onToggleGenerationFavorite,
}: CanvasWorkspaceProps): React.ReactElement {
  const storeActions = useGenerationControlsStoreActions();
  const { domain } = useGenerationControlsStoreState();
  const promptHighlights = useOptionalPromptHighlights();
  const { hasActiveContinuityShot, currentShot, updateShot } = useWorkspaceSession();
  const generationDomain = useSidebarGenerationDomain();
  const workspaceDomain = useSidebarWorkspaceDomain();
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

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

  const onStateSnapshotProp = generationsPanelProps.onStateSnapshot;
  const handleSnapshot = useCallback(
    (nextSnapshot: GenerationsPanelStateSnapshot) => {
      onStateSnapshotProp?.(nextSnapshot);
    },
    [onStateSnapshotProp]
  );

  const generationsRuntime = useGenerationsRuntime({
    ...generationsPanelProps,
    presentation: 'hero',
    onStateSnapshot: handleSnapshot,
  });

  useEffect(() => {
    setViewingId(null);
  }, [generationsPanelProps.promptVersionId]);

  const heroGeneration = generationsRuntime.heroGeneration;

  const galleryEntries = useMemo(
    () =>
      buildGalleryGenerationEntries({
        versions: generationsPanelProps.versions,
        runtimeGenerations: generationsRuntime.generations,
      }),
    [generationsPanelProps.versions, generationsRuntime.generations]
  );

  const galleryGenerations = useMemo(
    () => galleryEntries.map((entry) => entry.gallery),
    [galleryEntries]
  );

  const generationLookup = useMemo(() => {
    const lookup = new Map<string, Generation>();
    for (const entry of galleryEntries) {
      lookup.set(entry.generation.id, entry.generation);
    }
    return lookup;
  }, [galleryEntries]);

  const isEmptySession = useMemo(() => {
    const hasGenerations = galleryEntries.length > 0 || heroGeneration !== null;
    const hasStartFrame = Boolean(domain.startFrame);
    return !hasGenerations && !hasStartFrame;
  }, [galleryEntries.length, heroGeneration, domain.startFrame]);

  const galleryOpen = workspaceDomain?.galleryOpen ?? true;
  const setGalleryOpen = workspaceDomain?.setGalleryOpen;

  const handleSelectGeneration = useCallback((generationId: string): void => {
    setViewingId(generationId);
  }, []);

  const handleCloseGallery = useCallback((): void => {
    setGalleryOpen?.(false);
  }, [setGalleryOpen]);

  const handleReuse = useCallback(
    (generationId: string): void => {
      const generation = generationLookup.get(generationId);
      if (!generation) return;
      onReuseGeneration(generation);
      setViewingId(null);
    },
    [generationLookup, onReuseGeneration]
  );

  if (isEmptySession) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0D0E12]">
        <CanvasTopBar />

        <NewSessionView
          editorRef={editorRef}
          onInput={onInput}
          prompt={prompt}
          renderModelId={renderModelId}
          renderModelOptions={renderModelOptions}
          modelRecommendation={modelRecommendation}
          recommendedModelId={recommendedModelId}
          efficientModelId={efficientModelId}
          onModelChange={handleModelChange}
          onOpenMotion={() => {
            if (!domain.startFrame) return;
            setShowCameraMotionModal(true);
          }}
          {...(generationDomain?.onStartFrameUpload
            ? { onStartFrameUpload: generationDomain.onStartFrameUpload }
            : {})}
        />

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0D0E12]">
      <CanvasTopBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-8 pb-1">
          <ModelCornerSelector
            renderModelOptions={renderModelOptions}
            renderModelId={renderModelId}
            modelRecommendation={modelRecommendation}
            recommendedModelId={recommendedModelId}
            efficientModelId={efficientModelId}
            onModelChange={handleModelChange}
            className="bottom-6 left-5"
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-4">
            <CanvasHeroViewer generation={heroGeneration} />

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
        </div>

        {galleryOpen ? (
          <GalleryPanel
            generations={galleryGenerations}
            activeGenerationId={viewingId}
            onSelectGeneration={handleSelectGeneration}
            onClose={handleCloseGallery}
          />
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
          onSelect={(cameraPath) => {
            storeActions.setCameraMotion(cameraPath);
            setShowCameraMotionModal(false);
          }}
        />
      ) : null}
    </div>
  );
}
