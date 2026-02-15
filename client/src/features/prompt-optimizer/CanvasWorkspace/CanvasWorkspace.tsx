import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@/components/ToolSidebar/config/modelConfig';
import type { KeyframeTile } from '@/components/ToolSidebar/types';
import type { AssetSuggestion } from '@/features/assets/hooks/useTriggerAutocomplete';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useOptionalPromptHighlights } from '@/features/prompt-optimizer/context/PromptStateContext';
import { useWorkspaceSession } from '@/features/prompt-optimizer/context/WorkspaceSessionContext';
import type {
  GenerationsPanelProps,
  GenerationsPanelStateSnapshot,
} from '@/features/prompt-optimizer/GenerationsPanel/types';
import { GenerationsPanel } from '@/features/prompt-optimizer/GenerationsPanel';
import { trackModelRecommendationEvent } from '@/features/model-intelligence/api';
import { useModelSelectionRecommendation } from '@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation';
import type { PromptVersionEntry } from '@/hooks/types';
import { CanvasTopBar } from './components/CanvasTopBar';
import { CanvasVersionStrip } from './components/CanvasVersionStrip';
import { CanvasPromptBar } from './components/CanvasPromptBar';
import { CanvasSettingsRow } from './components/CanvasSettingsRow';
import { StoryboardStrip } from './components/StoryboardStrip';
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

const resolveLatestStoryboardId = (snapshot: GenerationsPanelStateSnapshot | null): string | null => {
  const candidates = snapshot?.generations?.filter(
    (generation) => generation.status === 'completed' && generation.mediaType === 'image-sequence'
  );
  if (!candidates?.length) return null;
  return [...candidates].sort((left, right) => {
    const leftTimestamp = left.completedAt ?? left.createdAt ?? 0;
    const rightTimestamp = right.completedAt ?? right.createdAt ?? 0;
    return rightTimestamp - leftTimestamp;
  })[0]?.id ?? null;
};

const resolveModelLabel = (selectedModelId: string): string => {
  if (selectedModelId === VIDEO_DRAFT_MODEL.id) return VIDEO_DRAFT_MODEL.label;
  return VIDEO_RENDER_MODELS.find((model) => model.id === selectedModelId)?.label ?? selectedModelId;
};

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
}: CanvasWorkspaceProps): React.ReactElement {
  const storeActions = useGenerationControlsStoreActions();
  const { domain } = useGenerationControlsStoreState();
  const promptHighlights = useOptionalPromptHighlights();
  const { hasActiveContinuityShot, currentShot, updateShot } = useWorkspaceSession();
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const [snapshot, setSnapshot] = useState<GenerationsPanelStateSnapshot | null>(null);
  const [isStoryboardDismissed, setIsStoryboardDismissed] = useState(false);

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

  const latestStoryboardId = useMemo(
    () => resolveLatestStoryboardId(snapshot),
    [snapshot]
  );

  useEffect(() => {
    if (!latestStoryboardId) return;
    setIsStoryboardDismissed(false);
  }, [latestStoryboardId]);

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
          ? {
              timeSinceRecommendationMs: Math.max(
                0,
                Math.round(recommendationAgeMs)
              ),
            }
          : {}),
      });

      storeActions.setSelectedModel(modelId);
      if (nextTier !== domain.videoTier) {
        storeActions.setVideoTier(nextTier);
      }

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

  const selectedModelLabel = resolveModelLabel(domain.selectedModel);
  const subtitle = `${selectedModelLabel} · ${durationSeconds}s`;

  const handleSnapshot = useCallback(
    (nextSnapshot: GenerationsPanelStateSnapshot) => {
      setSnapshot(nextSnapshot);
      generationsPanelProps.onStateSnapshot?.(nextSnapshot);
    },
    [generationsPanelProps]
  );

  const handleUseStoryboardFrame = useCallback(
    (frame: KeyframeTile) => {
      storeActions.setStartFrame(frame);
    },
    [storeActions]
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#0A0C11]">
      <CanvasVersionStrip
        versions={versionsPanelProps.versions}
        selectedVersionId={versionsPanelProps.selectedVersionId}
        onSelectVersion={versionsPanelProps.onSelectVersion}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CanvasTopBar
          title="Canvas Workspace"
          subtitle={subtitle}
          copied={copied}
          canUndo={canUndo}
          canRedo={canRedo}
          onCopy={onCopy}
          onShare={onShare}
          onUndo={onUndo}
          onRedo={onRedo}
        />

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <GenerationsPanel
            {...generationsPanelProps}
            presentation="hero"
            onStateSnapshot={handleSnapshot}
            className="h-full"
          />

          <ModelCornerSelector
            renderModelOptions={renderModelOptions}
            renderModelId={renderModelId}
            modelRecommendation={modelRecommendation}
            recommendedModelId={recommendedModelId}
            efficientModelId={efficientModelId}
            onModelChange={handleModelChange}
            className="bottom-4 left-4"
          />
        </div>

        {!isStoryboardDismissed ? (
          <StoryboardStrip
            snapshot={snapshot}
            onUseAsStartFrame={handleUseStoryboardFrame}
            onDismiss={() => setIsStoryboardDismissed(true)}
          />
        ) : null}

        <CanvasSettingsRow
          prompt={prompt}
          renderModelId={renderModelId}
          recommendationPromptId={modelRecommendation?.promptId}
          recommendedModelId={recommendedModelId}
          recommendationMode={recommendationMode}
          recommendationAgeMs={recommendationAgeMs}
          onOpenMotion={() => {
            if (!domain.startFrame) return;
            setShowCameraMotionModal(true);
          }}
        />

        <CanvasPromptBar
          editorRef={editorRef}
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
