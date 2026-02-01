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
import { useLocation } from 'react-router-dom';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { useToast } from '@components/Toast';
import { logger } from '@/services/LoggingService';
import type { Asset, AssetType } from '@shared/types/asset';
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
import { assetApi } from '@/features/assets/api/assetApi';
import { uploadPreviewImage } from '@/features/preview/api/previewApi';
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
} from './hooks';
import { useI2VContext } from '../hooks/useI2VContext';
import { PromptOptimizerWorkspaceView } from './components/PromptOptimizerWorkspaceView';

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
  mode: 'studio' | 'create';
}

function PromptOptimizerContent({
  user,
  convergenceHandoff,
  mode,
}: PromptOptimizerContentProps): React.ReactElement {
  const location = useLocation();
  const promptInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [assetEditorState, setAssetEditorState] = React.useState<{
    mode: 'create' | 'edit';
    asset?: Asset | null;
    preselectedType?: AssetType | null;
  } | null>(null);
  const [quickCreateState, setQuickCreateState] = React.useState<{
    isOpen: boolean;
    prefillTrigger?: string;
  }>({ isOpen: false });
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
    uuid,
  } = usePromptState();
  const assetsSidebar = useAssetsSidebar();
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
   * Handle convergence handoff - pre-fill prompt when coming from Create mode
   * (Requirement 17.2: Switch to Studio mode with converged prompt pre-filled)
   */
  useEffect(() => {
    if (mode !== 'studio') return;
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
    mode,
    promptOptimizer,
    setCameraMotion,
    setSubjectMotion,
    setDisplayedPromptSilently,
    setShowResults,
    toast,
  ]);

  const stablePromptContext = useStablePromptContext(promptContext);

  // ============================================================================
  // Custom Hooks - Business Logic Delegation
  // ============================================================================

  // Load prompt from URL parameter
  const { isLoading } = usePromptLoader({
    uuid,
    currentPromptUuid,
    navigate,
    toast,
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

  const saveOutputTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedOutputRef = React.useRef<string | null>(null);
  const promptMetaRef = React.useRef<{ uuid: string | null; docId: string | null }>({
    uuid: currentPromptUuid,
    docId: currentPromptDocId,
  });

  React.useEffect(() => {
    promptMetaRef.current = { uuid: currentPromptUuid, docId: currentPromptDocId };
    lastSavedOutputRef.current = null;
    setOutputSaveState('idle');
    setOutputLastSavedAt(null);
    if (saveOutputTimeoutRef.current) {
      clearTimeout(saveOutputTimeoutRef.current);
      saveOutputTimeoutRef.current = null;
    }
  }, [currentPromptUuid, currentPromptDocId]);

  React.useEffect(() => {
    return () => {
      if (saveOutputTimeoutRef.current) {
        clearTimeout(saveOutputTimeoutRef.current);
      }
    };
  }, []);

  const handleDisplayedPromptChangeWithAutosave = React.useCallback(
    (newText: string): void => {
      handleDisplayedPromptChange(newText);

      if (!currentPromptUuid) return;
      if (isApplyingHistoryRef.current) return;
      if (lastSavedOutputRef.current === null) {
        lastSavedOutputRef.current = promptOptimizer.displayedPrompt ?? '';
      }
      if (lastSavedOutputRef.current === newText) return;

      if (saveOutputTimeoutRef.current) {
        clearTimeout(saveOutputTimeoutRef.current);
      }

      const scheduledUuid = currentPromptUuid;
      const scheduledDocId = currentPromptDocId;
      setOutputSaveState('saving');

      saveOutputTimeoutRef.current = setTimeout(() => {
        const currentPromptMeta = promptMetaRef.current;
        if (!scheduledUuid) return;
        if (isApplyingHistoryRef.current) return;
        if (
          currentPromptMeta.uuid !== scheduledUuid ||
          currentPromptMeta.docId !== scheduledDocId
        ) {
          return;
        }
        if (lastSavedOutputRef.current === newText) return;

        try {
          // Fire-and-forget persistence. The underlying repository logs failures.
          promptHistory.updateEntryOutput(scheduledUuid, scheduledDocId, newText);
          setOutputSaveState('saved');
          setOutputLastSavedAt(Date.now());
        } catch {
          setOutputSaveState('error');
        }
        lastSavedOutputRef.current = newText;
        saveOutputTimeoutRef.current = null;
      }, 1000);
    },
    [
      handleDisplayedPromptChange,
      currentPromptUuid,
      currentPromptDocId,
      isApplyingHistoryRef,
      promptOptimizer.displayedPrompt,
      promptHistory,
      setOutputLastSavedAt,
      setOutputSaveState,
    ]
  );

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

  const handleEditAsset = useCallback(
    (assetId: string): void => {
      const asset = assetsSidebar.assets.find((item) => item.id === assetId) ?? null;
      if (!asset) return;
      setAssetEditorState({ mode: 'edit', asset });
    },
    [assetsSidebar.assets]
  );

  const handleCreateAsset = useCallback((type: AssetType): void => {
    if (type === 'character') {
      setQuickCreateState({ isOpen: true });
      return;
    }
    setAssetEditorState({ mode: 'create', preselectedType: type });
  }, []);

  const handleCreateFromTrigger = useCallback((trigger: string): void => {
    const trimmed = trigger.replace(/^@/, '');
    setQuickCreateState({ isOpen: true, prefillTrigger: trimmed });
  }, []);

  const closeAssetEditor = useCallback(() => {
    setAssetEditorState(null);
  }, []);

  const handleAssetCreate = useCallback(
    async (data: {
      type: AssetType;
      trigger: string;
      name: string;
      textDefinition?: string;
      negativePrompt?: string;
    }): Promise<Asset> => {
      const asset = await assetApi.create(data);
      await assetsSidebar.refresh();
      return asset;
    },
    [assetsSidebar]
  );

  const handleAssetUpdate = useCallback(
    async (
      assetId: string,
      data: { trigger?: string; name?: string; textDefinition?: string; negativePrompt?: string }
    ): Promise<Asset> => {
      const asset = await assetApi.update(assetId, data);
      await assetsSidebar.refresh();
      return asset;
    },
    [assetsSidebar]
  );

  const handleAddAssetImage = useCallback(
    async (
      assetId: string,
      file: File,
      metadata: Record<string, string | undefined>
    ): Promise<void> => {
      await assetApi.addImage(assetId, file, metadata);
      await assetsSidebar.refresh();
    },
    [assetsSidebar]
  );

  const handleDeleteAssetImage = useCallback(
    async (assetId: string, imageId: string): Promise<void> => {
      await assetApi.deleteImage(assetId, imageId);
      await assetsSidebar.refresh();
    },
    [assetsSidebar]
  );

  const handleSetPrimaryAssetImage = useCallback(
    async (assetId: string, imageId: string): Promise<void> => {
      await assetApi.setPrimaryImage(assetId, imageId);
      await assetsSidebar.refresh();
    },
    [assetsSidebar]
  );

  const handleImageUpload = useCallback(
    async (file: File): Promise<void> => {
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const maxBytes = 10 * 1024 * 1024;

      if (!allowedTypes.has(file.type)) {
        toast.warning('Only PNG, JPEG, and WebP files are supported.');
        return;
      }
      if (file.size > maxBytes) {
        toast.warning('Image must be 10MB or smaller.');
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

  const closeQuickCreate = useCallback(() => {
    setQuickCreateState({ isOpen: false });
  }, []);

  const handleQuickCreateComplete = useCallback(
    async (_asset: Asset): Promise<void> => {
      await assetsSidebar.refresh();
      setQuickCreateState({ isOpen: false });
    },
    [assetsSidebar]
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

  const handleSidebarPromptChange = useCallback(
    (nextPrompt: string): void => {
      promptOptimizer.setInputPrompt(nextPrompt);
      if (promptOptimizer.displayedPrompt?.trim()) {
        setDisplayedPromptSilently('');
        setShowResults(false);
      }
    },
    [promptOptimizer, setDisplayedPromptSilently, setShowResults]
  );

  const handleDraft = useCallback(
    (model: 'flux-kontext' | 'wan-2.2'): void => {
      generationControls?.onDraft?.(model);
    },
    [generationControls]
  );

  const handleRender = useCallback(
    (model: string): void => {
      generationControls?.onRender?.(model);
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
    onCreateFromTrigger: handleCreateFromTrigger,
    onDraft: handleDraft,
    onRender: handleRender,
    onStoryboard: handleStoryboard,
    onImageUpload: handleImageUpload,
    assets: assetsSidebar.assets,
    assetsByType: assetsSidebar.byType,
    isLoadingAssets: assetsSidebar.isLoading,
    onInsertTrigger: insertTriggerAtCursor,
    onEditAsset: handleEditAsset,
    onCreateAsset: handleCreateAsset,
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
    handleCreateFromTrigger,
    handleDraft,
    handleRender,
    handleStoryboard,
    handleImageUpload,
    assetsSidebar.assets,
    assetsSidebar.byType,
    assetsSidebar.isLoading,
    insertTriggerAtCursor,
    handleEditAsset,
    handleCreateAsset,
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
      onQuickCreateClose={closeQuickCreate}
      onQuickCreateComplete={handleQuickCreateComplete}
      assetEditorState={assetEditorState}
      assetEditorHandlers={{
        onClose: closeAssetEditor,
        onCreate: handleAssetCreate,
        onUpdate: handleAssetUpdate,
        onAddImage: handleAddAssetImage,
        onDeleteImage: handleDeleteAssetImage,
        onSetPrimaryImage: handleSetPrimaryAssetImage,
      }}
      detectedAssetsPrompt={promptForAssets}
      detectedAssets={assetsSidebar.assets}
      onEditAsset={handleEditAsset}
      onCreateFromTrigger={handleCreateFromTrigger}
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
  mode?: 'studio' | 'create';
}

function PromptOptimizerWorkspace({
  convergenceHandoff,
  mode = 'studio',
}: PromptOptimizerWorkspaceProps): React.ReactElement {
  const user = useAuthUser();

  return (
    <PromptStateProvider user={user}>
      <PromptOptimizerContent user={user} convergenceHandoff={convergenceHandoff} mode={mode} />
    </PromptStateProvider>
  );
}

export default PromptOptimizerWorkspace;
