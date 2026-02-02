/**
 * PromptOptimizerWorkspace - Main Orchestrator
 *
 * Coordinates business logic and renders the canvas view with a unified top bar.
 *
 * This component focuses on:
 * - Coordinating hooks
 * - Business logic delegation
 * - Conditional layout rendering
 */

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { useToast } from '@components/Toast';
import { logger } from '@/services/LoggingService';
import type { DraftModel, GenerationOverrides } from '@components/ToolSidebar/types';
import { useAuthUser } from '@hooks/useAuthUser';
import type { User } from '../context/types';
import type { CameraMotionCategory, CameraPath, ConvergenceHandoff } from '@/features/convergence/types';
import type { OptimizationOptions } from '../types';
import type { CapabilityValues } from '@shared/capabilities';
import { useAssetsSidebar } from '../components/AssetsSidebar';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import { useGenerationControlsContext } from '../context/GenerationControlsContext';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '../context/GenerationControlsStore';
import { resolveActiveModelLabel, resolveActiveStatusLabel } from '../utils/activeStatusLabel';
import { scrollToSpanById } from '../utils/scrollToSpanById';
import { uploadPreviewImage, validatePreviewImageFile } from '@/features/preview/api/previewApi';
import {
  usePromptLoader,
  useHighlightsPersistence,
  useUndoRedo,
  usePromptOptimization,
  useImprovementFlow,
  useConceptBrainstorm,
  useEnhancementSuggestions,
  usePromptKeyframesSync,
  usePromptHistoryActions,
  useStablePromptContext,
  usePromptCoherence,
  useAutoSave,
  useAssetManagement,
} from './hooks';
import { useI2VContext } from '../hooks/useI2VContext';
import { PromptOptimizerWorkspaceView } from './components/PromptOptimizerWorkspaceView';
import { WorkspaceSessionProvider, useWorkspaceSession } from '../context/WorkspaceSessionContext';
import { debounce } from '../utils/debounce';

const log = logger.child('PromptOptimizerWorkspace');
const buildDefaultCameraTransform = (): CameraPath['start'] => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { pitch: 0, yaw: 0, roll: 0 },
});

const formatCameraMotionLabel = (id: string): string =>
  id
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const inferCameraMotionCategory = (id: string): CameraMotionCategory => {
  if (id === 'static') return 'static';
  if (id.startsWith('pan_') || id.startsWith('tilt_') || id.startsWith('dutch_')) {
    return 'pan_tilt';
  }
  if (['push_in', 'pull_back', 'track_left', 'track_right'].includes(id)) {
    return 'dolly';
  }
  if (id.startsWith('crane_') || id.startsWith('pedestal_')) {
    return 'crane';
  }
  if (id.startsWith('arc_')) {
    return 'orbital';
  }
  if (id === 'reveal') {
    return 'compound';
  }
  return 'static';
};

const buildFallbackCameraPath = (cameraMotionId: string): CameraPath => ({
  id: cameraMotionId,
  label: formatCameraMotionLabel(cameraMotionId),
  category: inferCameraMotionCategory(cameraMotionId),
  start: buildDefaultCameraTransform(),
  end: buildDefaultCameraTransform(),
  duration: 1,
});

/**
 * Inner component with access to PromptStateContext
 */
interface PromptOptimizerContentProps {
  user: User | null;
  /** Handoff data from Visual Convergence for prompt pre-fill (Requirement 17.2) */
  convergenceHandoff?: ConvergenceHandoff | null | undefined;
}

function PromptOptimizerContent({
  user,
  convergenceHandoff,
}: PromptOptimizerContentProps): React.ReactElement {
  const location = useLocation();
  const promptInputRef = React.useRef<HTMLTextAreaElement>(null);
  // Track if we've already applied the handoff to prevent re-applying
  const handoffAppliedRef = React.useRef<string | null>(null);

  const toast = useToast();
  const {
    // State
    selectedMode,
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    showResults,
    showSettings,
    setShowSettings,
    showShortcuts,
    setShowShortcuts,
    showHistory,
    setShowHistory,
    showImprover,
    setShowImprover,
    showBrainstorm,
    setShowBrainstorm,
    suggestionsData,
    setSuggestionsData,
    setConceptElements,
    promptContext,
    setPromptContext,
    currentPromptUuid,
    currentPromptDocId,
    initialHighlights,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    setShowResults,
    setCanUndo,
    setCanRedo,

    // Refs
    latestHighlightRef,
    persistedSignatureRef,
    registerPromptEdit,
    resetVersionEdits,
    undoStackRef,
    redoStackRef,
    isApplyingHistoryRef,
    skipLoadFromUrlRef,

    // Hooks
    promptOptimizer,
    promptHistory,

    // Functions
    applyInitialHighlightSnapshot,
    resetEditStacks,
    setDisplayedPromptSilently,
    handleCreateNew,
    loadFromHistory,
    setOutputSaveState,
    setOutputLastSavedAt,

    // Navigation
    navigate,
    sessionId,
  } = usePromptState();
  const assetsSidebar = useAssetsSidebar();
  const {
    assetEditorState,
    quickCreateState,
    handlers: assetManagement,
  } = useAssetManagement({
    assets: assetsSidebar.assets,
    refreshAssets: assetsSidebar.refresh,
  });
  const { controls: generationControls } = useGenerationControlsContext();
  const { domain } = useGenerationControlsStoreState();
  const {
    setKeyframes,
    addKeyframe,
    removeKeyframe,
    clearKeyframes,
    setCameraMotion,
    setSubjectMotion,
  } = useGenerationControlsStoreActions();
  const keyframes = domain.keyframes;
  const cameraMotion = domain.cameraMotion;
  const subjectMotion = domain.subjectMotion;
  const i2vContext = useI2VContext();
  const {
    isSequenceMode,
    currentShotId,
    currentShot,
    updateShot,
  } = useWorkspaceSession();

  const { serializedKeyframes: serializedKeyframesSync, onLoadKeyframes } = usePromptKeyframesSync({
    keyframes,
    setKeyframes,
    currentPromptUuid,
    currentPromptDocId,
    promptHistory,
  });

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldOpenSettings = params.get('settings');
    if (shouldOpenSettings !== '1' && shouldOpenSettings !== 'true') return;

    setShowSettings(true);

    params.delete('settings');
    const nextSearch = params.toString();
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`;
    navigate(nextUrl, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, setShowSettings]);

  /**
   * Handle convergence handoff - pre-fill prompt when provided
   * (Requirement 17.2: Switch to Studio mode with converged prompt pre-filled)
   */
  useEffect(() => {
    if (!convergenceHandoff) return;
    
    // Create a unique key for this handoff to prevent re-applying
    const handoffKey = `${convergenceHandoff.prompt.slice(0, 50)}-${convergenceHandoff.cameraMotion}`;
    
    // Skip if we've already applied this handoff
    if (handoffAppliedRef.current === handoffKey) return;
    
    // Mark this handoff as applied
    handoffAppliedRef.current = handoffKey;
    
    // Pre-fill the input prompt with the converged prompt
    promptOptimizer.setInputPrompt(convergenceHandoff.prompt);

    const handoffCameraMotionId = convergenceHandoff.cameraMotion?.trim();
    if (handoffCameraMotionId) {
      setCameraMotion(buildFallbackCameraPath(handoffCameraMotionId));
    }
    const handoffSubjectMotion = convergenceHandoff.subjectMotion?.trim();
    if (handoffSubjectMotion) {
      setSubjectMotion(handoffSubjectMotion);
    }
    
    // Clear any existing displayed prompt to show the input
    setDisplayedPromptSilently('');
    setShowResults(false);
    
    // Show a toast notification
    toast.success('Prompt loaded from Visual Convergence');
    
    // Log the handoff for debugging
    log.info('Applied convergence handoff', {
      promptLength: convergenceHandoff.prompt.length,
      lockedDimensionsCount: convergenceHandoff.lockedDimensions.length,
      cameraMotion: convergenceHandoff.cameraMotion,
      hasSubjectMotion: Boolean(convergenceHandoff.subjectMotion),
    });
  }, [
    convergenceHandoff,
    promptOptimizer,
    setCameraMotion,
    setSubjectMotion,
    setDisplayedPromptSilently,
    setShowResults,
    toast,
  ]);

  useEffect(() => {
    if (!isSequenceMode || !currentShot) return;
    const rawPrompt = currentShot.userPrompt ?? '';
    const nextPrompt = rawPrompt.trim() ? rawPrompt : '';
    if (promptOptimizer.inputPrompt !== nextPrompt) {
      promptOptimizer.setInputPrompt(nextPrompt);
      if (promptOptimizer.displayedPrompt?.trim()) {
        setDisplayedPromptSilently('');
        setShowResults(false);
      }
    }
  }, [
    isSequenceMode,
    currentShot?.id,
    promptOptimizer,
    setDisplayedPromptSilently,
    setShowResults,
  ]);

  useEffect(() => {
    if (!isSequenceMode || !currentShot) return;
    const shotModelId = currentShot.modelId?.trim();
    if (!shotModelId) return;
    if (selectedModel === shotModelId) return;
    setSelectedModel(shotModelId);
  }, [currentShot?.id, currentShot?.modelId, isSequenceMode, selectedModel, setSelectedModel]);

  const stablePromptContext = useStablePromptContext(promptContext);

  // ============================================================================
  // Custom Hooks - Business Logic Delegation
  // ============================================================================

  // Load prompt from URL parameter
  const { isLoading } = usePromptLoader({
    sessionId,
    currentPromptUuid,
    navigate,
    toast,
    user,
    promptOptimizer,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    resetVersionEdits,
    setCurrentPromptDocId,
    setCurrentPromptUuid,
    setShowResults,
    setSelectedModel,
    setPromptContext,
    onLoadKeyframes,
    skipLoadFromUrlRef,
  });

  // Highlights persistence
  const { handleHighlightsPersist } = useHighlightsPersistence({
    currentPromptUuid,
    currentPromptDocId,
    user,
    toast,
    applyInitialHighlightSnapshot,
    promptHistory,
    latestHighlightRef,
    persistedSignatureRef,
  });

  // Undo/Redo functionality
  const { handleUndo, handleRedo, handleDisplayedPromptChange } = useUndoRedo({
    promptOptimizer,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    onEdit: ({ previousText, nextText }) =>
      registerPromptEdit({ previousText, nextText, source: 'manual' }),
    undoStackRef,
    redoStackRef,
    latestHighlightRef,
    isApplyingHistoryRef,
    setCanUndo,
    setCanRedo,
  });
  const { handleDisplayedPromptChangeWithAutosave } = useAutoSave({
    currentPromptUuid,
    currentPromptDocId,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isApplyingHistoryRef,
    handleDisplayedPromptChange,
    promptHistory,
    setOutputSaveState,
    setOutputLastSavedAt,
  });

  const {
    handleLoadFromHistory,
    handleCreateNewWithKeyframes,
    handleDuplicate,
    handleRename,
  } = usePromptHistoryActions({
    promptHistory,
    setKeyframes,
    loadFromHistory,
    handleCreateNew,
  });

  const insertTriggerAtCursor = useCallback(
    (trigger: string, range?: { start: number; end: number }): void => {
      const input = promptInputRef.current;
      const currentText = promptOptimizer.inputPrompt;
      const normalizedTrigger = trigger.startsWith('@') ? trigger : `@${trigger}`;

      if (!input) {
        promptOptimizer.setInputPrompt(`${currentText}${normalizedTrigger}`);
        return;
      }

      const isFocused = document.activeElement === input;
      const start = range?.start ?? (isFocused ? input.selectionStart ?? currentText.length : currentText.length);
      const end = range?.end ?? (isFocused ? input.selectionEnd ?? currentText.length : currentText.length);
      const before = currentText.slice(0, start);
      const after = currentText.slice(end);
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
      const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
      const insertion = `${needsSpaceBefore ? ' ' : ''}${normalizedTrigger}${
        needsSpaceAfter ? ' ' : ''
      }`;
      const nextText = `${before}${insertion}${after}`;

      promptOptimizer.setInputPrompt(nextText);
      const nextCursor = before.length + insertion.length;
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [promptOptimizer]
  );

  const handleImageUpload = useCallback(
    async (file: File): Promise<void> => {
      const validation = validatePreviewImageFile(file);
      if (!validation.valid) {
        toast.warning(validation.error);
        return;
      }

      try {
        const response = await uploadPreviewImage(file, {}, { source: 'tool-sidebar' });
        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || 'Failed to upload image');
        }
        const imageUrl = response.data.viewUrl || response.data.imageUrl;
        if (!imageUrl) {
          throw new Error('Upload did not return an image URL');
        }
        addKeyframe({
          url: imageUrl,
          source: 'upload',
          ...(response.data.storagePath ? { storagePath: response.data.storagePath } : {}),
          ...(response.data.viewUrlExpiresAt ? { viewUrlExpiresAt: response.data.viewUrlExpiresAt } : {}),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [addKeyframe, toast]
  );

  const activeStatusLabel = resolveActiveStatusLabel({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    hasHighlights: Boolean(initialHighlights),
  });
  const activeModelLabel = resolveActiveModelLabel(selectedModel);
  const promptForGeneration = promptOptimizer.inputPrompt;
  const isGenerating = generationControls?.isGenerating ?? false;
  const isGenerationReady = Boolean(generationControls);

  const debouncedShotPromptUpdate = useMemo(
    () =>
      debounce((shotId: string, nextPrompt: string) => {
        void updateShot(shotId, { prompt: nextPrompt });
      }, 500),
    [updateShot]
  );

  useEffect(() => () => debouncedShotPromptUpdate.cancel(), [debouncedShotPromptUpdate]);

  const handleSidebarPromptChange = useCallback(
    (nextPrompt: string): void => {
      promptOptimizer.setInputPrompt(nextPrompt);
      if (promptOptimizer.displayedPrompt?.trim()) {
        setDisplayedPromptSilently('');
        setShowResults(false);
      }
      if (isSequenceMode && currentShotId) {
        debouncedShotPromptUpdate(currentShotId, nextPrompt);
      }
    },
    [
      promptOptimizer,
      setDisplayedPromptSilently,
      setShowResults,
      isSequenceMode,
      currentShotId,
      debouncedShotPromptUpdate,
    ]
  );

  const handleDraft = useCallback(
    (model: DraftModel, overrides?: GenerationOverrides): void => {
      generationControls?.onDraft?.(model, overrides);
    },
    [generationControls]
  );

  const handleRender = useCallback(
    (model: string, overrides?: GenerationOverrides): void => {
      generationControls?.onRender?.(model, overrides);
    },
    [generationControls]
  );

  const handleStoryboard = useCallback((): void => {
    generationControls?.onStoryboard?.();
  }, [generationControls]);

  const promptForAssets = useMemo(() => {
    if (showResults && promptOptimizer.displayedPrompt) {
      return promptOptimizer.displayedPrompt;
    }
    return promptOptimizer.inputPrompt;
  }, [promptOptimizer.displayedPrompt, promptOptimizer.inputPrompt, showResults]);

  const optimizationGenerationParams = useMemo<CapabilityValues>(
    () => ({
      ...(generationParams ?? {}),
      ...(cameraMotion?.id ? { camera_motion_id: cameraMotion.id } : {}),
      ...(subjectMotion.trim() ? { subject_motion: subjectMotion.trim() } : {}),
    }),
    [generationParams, cameraMotion?.id, subjectMotion]
  );

  // Prompt optimization
  const { handleOptimize } = usePromptOptimization({
    promptOptimizer,
    promptHistory,
    promptContext,
    selectedMode,
    selectedModel,
    generationParams: optimizationGenerationParams,
    keyframes: serializedKeyframesSync,
    startImageUrl: i2vContext.startImageUrl,
    sourcePrompt: i2vContext.startImageSourcePrompt,
    constraintMode: i2vContext.constraintMode,
    currentPromptUuid,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    setDisplayedPromptSilently,
    setShowResults,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    persistedSignatureRef,
    skipLoadFromUrlRef,
    navigate,
  });
  const handleSidebarOptimize = useCallback(
    (promptToOptimize?: string, options?: OptimizationOptions): Promise<void> =>
      handleOptimize(promptToOptimize, undefined, options),
    [handleOptimize]
  );

  // Improvement flow
  const { handleImproveFirst, handleImprovementComplete } = useImprovementFlow({
    promptOptimizer,
    toast,
    setShowImprover,
    handleOptimize,
  });

  // Concept brainstorm flow
  const { handleConceptComplete, handleSkipBrainstorm } = useConceptBrainstorm({
    promptOptimizer,
    promptHistory,
    selectedMode,
    selectedModel,
    generationParams: optimizationGenerationParams,
    keyframes: serializedKeyframesSync,
    setConceptElements,
    setPromptContext,
    setShowBrainstorm,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    setDisplayedPromptSilently,
    setShowResults,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    persistedSignatureRef,
    skipLoadFromUrlRef,
    navigate,
    toast,
  });

  const {
    issues: coherenceIssues,
    isChecking: isCoherenceChecking,
    isPanelExpanded,
    setIsPanelExpanded,
    affectedSpanIds,
    spanIssueMap,
    runCheck: runCoherenceCheck,
    dismissIssue,
    dismissAll,
    applyFix,
  } = usePromptCoherence({
    promptOptimizer,
    latestHighlightRef,
    applyInitialHighlightSnapshot,
    handleDisplayedPromptChange,
    currentPromptUuid,
    currentPromptDocId,
    promptHistory,
    toast,
    log,
  });

  // Enhancement suggestions
  const { fetchEnhancementSuggestions, handleSuggestionClick } = useEnhancementSuggestions({
    promptOptimizer,
    selectedMode,
    suggestionsData,
    setSuggestionsData,
    handleDisplayedPromptChange,
    stablePromptContext,
    toast,
    applyInitialHighlightSnapshot,
    latestHighlightRef,
    currentPromptUuid,
    currentPromptDocId,
    promptHistory,
    onCoherenceCheck: runCoherenceCheck,
    i2vContext,
  });

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================
  useKeyboardShortcuts({
    openShortcuts: () => setShowShortcuts(true),
    openSettings: () => setShowSettings(true),
    createNew: handleCreateNewWithKeyframes,
    optimize: () => !promptOptimizer.isProcessing && showResults === false && handleOptimize(),
    improveFirst: handleImproveFirst,
    canCopy: () => showResults && Boolean(promptOptimizer.displayedPrompt),
    copy: () => {
      navigator.clipboard.writeText(promptOptimizer.displayedPrompt);
      toast.success('Copied to clipboard!');
    },
    export: () => showResults && toast.info('Use export button in canvas'),
    toggleSidebar: () => setShowHistory(!showHistory),
    switchMode: () => {
      // Implementation from original
    },
    applySuggestion: (index: number) => {
      const suggestion = suggestionsData?.suggestions?.[index];
      if (suggestion) {
        handleSuggestionClick(suggestion);
      }
    },
    closeModal: () => {
      if (showSettings) setShowSettings(false);
      else if (showShortcuts) setShowShortcuts(false);
      else if (showImprover) setShowImprover(false);
      else if (showBrainstorm) setShowBrainstorm(false);
      else if (suggestionsData) setSuggestionsData(null);
    },
  });

  // ============================================================================
  // Render
  // ============================================================================
  // Only show the blocking loading UI when we are actively loading a prompt.
  const shouldShowLoading = isLoading;
  const toggleCoherencePanelExpanded = useCallback(() => {
    setIsPanelExpanded((prev) => !prev);
  }, []);

  const toolSidebarProps = useMemo(() => ({
    history: promptHistory.history,
    filteredHistory: promptHistory.filteredHistory,
    isLoadingHistory: promptHistory.isLoadingHistory,
    searchQuery: promptHistory.searchQuery,
    onSearchChange: promptHistory.setSearchQuery,
    onLoadFromHistory: handleLoadFromHistory,
    onCreateNew: handleCreateNewWithKeyframes,
    onDelete: promptHistory.deleteFromHistory,
    onDuplicate: handleDuplicate,
    onRename: handleRename,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
    prompt: promptForGeneration,
    onPromptChange: handleSidebarPromptChange,
    onOptimize: handleSidebarOptimize,
    showResults,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    genericOptimizedPrompt: promptOptimizer.genericOptimizedPrompt ?? null,
    promptInputRef,
    onCreateFromTrigger: assetManagement.onCreateFromTrigger,
    onDraft: handleDraft,
    onRender: handleRender,
    onStoryboard: handleStoryboard,
    onImageUpload: handleImageUpload,
    assets: assetsSidebar.assets,
    assetsByType: assetsSidebar.byType,
    isLoadingAssets: assetsSidebar.isLoading,
    onInsertTrigger: insertTriggerAtCursor,
    onEditAsset: assetManagement.onEditAsset,
    onCreateAsset: assetManagement.onCreateAsset,
  }), [
    promptHistory.history,
    promptHistory.filteredHistory,
    promptHistory.isLoadingHistory,
    promptHistory.searchQuery,
    promptHistory.setSearchQuery,
    handleLoadFromHistory,
    handleCreateNewWithKeyframes,
    promptHistory.deleteFromHistory,
    handleDuplicate,
    handleRename,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
    promptForGeneration,
    handleSidebarPromptChange,
    handleSidebarOptimize,
    showResults,
    promptOptimizer.isProcessing,
    promptOptimizer.isRefining,
    promptOptimizer.genericOptimizedPrompt,
    promptInputRef,
    assetManagement.onCreateFromTrigger,
    handleDraft,
    handleRender,
    handleStoryboard,
    handleImageUpload,
    assetsSidebar.assets,
    assetsSidebar.byType,
    assetsSidebar.isLoading,
    insertTriggerAtCursor,
    assetManagement.onEditAsset,
    assetManagement.onCreateAsset,
  ]);

  const promptResultsLayoutProps = useMemo(() => ({
    user,
    onDisplayedPromptChange: handleDisplayedPromptChangeWithAutosave,
    onReoptimize: handleOptimize,
    onFetchSuggestions: fetchEnhancementSuggestions,
    onSuggestionClick: handleSuggestionClick,
    onHighlightsPersist: handleHighlightsPersist,
    onUndo: handleUndo,
    onRedo: handleRedo,
    stablePromptContext,
    suggestionsData,
    displayedPrompt: promptOptimizer.displayedPrompt,
    coherenceAffectedSpanIds: affectedSpanIds,
    coherenceSpanIssueMap: spanIssueMap,
    coherenceIssues,
    isCoherenceChecking,
    isCoherencePanelExpanded: isPanelExpanded,
    onToggleCoherencePanelExpanded: toggleCoherencePanelExpanded,
    onDismissCoherenceIssue: dismissIssue,
    onDismissAllCoherenceIssues: dismissAll,
    onApplyCoherenceFix: applyFix,
    onScrollToCoherenceSpan: scrollToSpanById,
    i2vContext,
  }), [
    user,
    handleDisplayedPromptChangeWithAutosave,
    handleOptimize,
    fetchEnhancementSuggestions,
    handleSuggestionClick,
    handleHighlightsPersist,
    handleUndo,
    handleRedo,
    stablePromptContext,
    suggestionsData,
    promptOptimizer.displayedPrompt,
    affectedSpanIds,
    spanIssueMap,
    coherenceIssues,
    isCoherenceChecking,
    isPanelExpanded,
    toggleCoherencePanelExpanded,
    dismissIssue,
    dismissAll,
    applyFix,
    scrollToSpanById,
    i2vContext,
  ]);

  return (
    <PromptOptimizerWorkspaceView
      toolSidebarProps={toolSidebarProps}
      showHistory={showHistory}
      onToggleHistory={setShowHistory}
      shouldShowLoading={shouldShowLoading}
      promptModalsProps={{
        onImprovementComplete: handleImprovementComplete,
        onConceptComplete: handleConceptComplete,
        onSkipBrainstorm: handleSkipBrainstorm,
      }}
      quickCreateState={quickCreateState}
      onQuickCreateClose={assetManagement.onCloseQuickCreate}
      onQuickCreateComplete={assetManagement.onQuickCreateComplete}
      assetEditorState={assetEditorState}
      assetEditorHandlers={{
        onClose: assetManagement.onCloseAssetEditor,
        onCreate: assetManagement.onCreate,
        onUpdate: assetManagement.onUpdate,
        onAddImage: assetManagement.onAddImage,
        onDeleteImage: assetManagement.onDeleteImage,
        onSetPrimaryImage: assetManagement.onSetPrimaryImage,
      }}
      detectedAssetsPrompt={promptForAssets}
      detectedAssets={assetsSidebar.assets}
      onEditAsset={assetManagement.onEditAsset}
      onCreateFromTrigger={assetManagement.onCreateFromTrigger}
      promptResultsLayoutProps={promptResultsLayoutProps}
      debugProps={{
        enabled:
          false &&
          (import.meta.env.DEV ||
            new URLSearchParams(window.location.search).get('debug') === 'true'),
        inputPrompt: promptOptimizer.inputPrompt,
        displayedPrompt: promptOptimizer.displayedPrompt,
        optimizedPrompt: promptOptimizer.optimizedPrompt,
        selectedMode,
        promptContext: stablePromptContext,
      }}
    />
  );
}

/**
 * Outer component with auth state management
 */
interface PromptOptimizerWorkspaceProps {
  /** Handoff data from Visual Convergence for prompt pre-fill (Requirement 17.2) */
  convergenceHandoff?: ConvergenceHandoff | null;
}

function PromptOptimizerWorkspace({
  convergenceHandoff,
}: PromptOptimizerWorkspaceProps): React.ReactElement {
  const user = useAuthUser();
  const { sessionId } = useParams<{ sessionId?: string }>();

  return (
    <WorkspaceSessionProvider sessionId={sessionId}>
      <PromptStateProvider user={user}>
        <PromptOptimizerContent user={user} convergenceHandoff={convergenceHandoff} />
      </PromptStateProvider>
    </WorkspaceSessionProvider>
  );
}

export default PromptOptimizerWorkspace;
