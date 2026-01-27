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

import React, { useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@components/navigation/AppShell';
import DebugButton from '@components/DebugButton';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { useToast } from '@components/Toast';
import { getAuthRepository } from '@/repositories';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import type { Asset, AssetType } from '@shared/types/asset';
import type { PromptHistoryEntry } from '@hooks/types';
import type { CoherenceRecommendation } from '../types/coherence';
import type { User } from '../context/types';
import type { ConvergenceHandoff } from '@/features/convergence/types';
import type { OptimizationOptions } from '../types';
import type { CapabilityValues } from '@shared/capabilities';
import {
  useCoherenceAnnotations,
  type CoherenceIssue,
} from '../components/coherence/useCoherenceAnnotations';
import { PromptModals } from '../components/PromptModals';
import { useAssetsSidebar } from '../components/AssetsSidebar';
import { DetectedAssets } from '../components/DetectedAssets';
import { QuickCharacterCreate } from '../components/QuickCharacterCreate';
import { PromptResultsLayout } from '../layouts/PromptResultsLayout';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import {
  useGenerationControlsContext,
} from '../context/GenerationControlsContext';
import type { VideoTier } from '@components/ToolSidebar/types';
import { applyCoherenceRecommendation } from '../utils/applyCoherenceRecommendation';
import { scrollToSpanById } from '../utils/scrollToSpanById';
import AssetEditor from '@/features/assets/components/AssetEditor';
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
} from './hooks';
import { useI2VContext } from '../hooks/useI2VContext';

const log = logger.child('PromptOptimizerWorkspace');

export function resolveActiveStatusLabel(params: {
  inputPrompt: string;
  displayedPrompt: string;
  isProcessing: boolean;
  isRefining: boolean;
  hasHighlights: boolean;
}): string {
  const hasInput = params.inputPrompt.trim().length > 0;
  const hasOutput = params.displayedPrompt.trim().length > 0;

  if (params.isRefining) return 'Refining';
  if (params.isProcessing) return 'Optimizing';
  if (!hasInput && !hasOutput) return 'Draft';
  if (hasOutput && params.hasHighlights) return 'Generated';
  if (hasOutput) return 'Optimized';
  if (hasInput) return 'Draft';
  return 'Incomplete';
}

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
  const {
    controls: generationControls,
    keyframes,
    addKeyframe,
    removeKeyframe,
    clearKeyframes,
    cameraMotion,
    subjectMotion,
    setCameraMotion,
    setSubjectMotion,
  } = useGenerationControlsContext();
  const i2vContext = useI2VContext();
  const [videoTier, setVideoTier] = React.useState<VideoTier>('render');

  useEffect(() => {
    if (mode === 'create') return;
    setCameraMotion(null);
    setSubjectMotion('');
  }, [mode, setCameraMotion, setSubjectMotion]);

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
  }, [convergenceHandoff, mode, promptOptimizer, setDisplayedPromptSilently, setShowResults, toast]);

  // Stabilize promptContext to prevent infinite loops
  const stablePromptContext = useMemo(() => {
    if (!promptContext) return null;
    return promptContext;
  }, [
    promptContext?.elements?.subject,
    promptContext?.elements?.action,
    promptContext?.elements?.location,
    promptContext?.elements?.time,
    promptContext?.elements?.mood,
    promptContext?.elements?.style,
    promptContext?.elements?.event,
    promptContext?.metadata?.format,
    promptContext?.version,
  ]);

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

  const handleDuplicate = useCallback(
    async (entry: PromptHistoryEntry): Promise<void> => {
      const mode =
        typeof entry.mode === 'string' && entry.mode.trim()
          ? entry.mode.trim()
          : 'video';
      const result = await promptHistory.saveToHistory(
        entry.input,
        entry.output,
        entry.score ?? null,
        mode,
        entry.targetModel ?? null,
        (entry.generationParams as Record<string, unknown>) ?? null,
        entry.brainstormContext ?? null,
        entry.highlightCache ?? null,
        null,
        entry.title ?? null
      );

      if (result?.uuid) {
        loadFromHistory({
          id: result.id,
          uuid: result.uuid,
          timestamp: new Date().toISOString(),
          title: entry.title ?? null,
          input: entry.input,
          output: entry.output,
          score: entry.score ?? null,
          mode,
          targetModel: entry.targetModel ?? null,
          generationParams: entry.generationParams ?? null,
          brainstormContext: entry.brainstormContext ?? null,
          highlightCache: entry.highlightCache ?? null,
          versions: Array.isArray(entry.versions) ? entry.versions : [],
        });
      }
    },
    [promptHistory, loadFromHistory]
  );

  const handleRename = useCallback(
    (entry: PromptHistoryEntry, title: string): void => {
      if (!entry.uuid) return;
      promptHistory.updateEntryPersisted(entry.uuid, entry.id ?? null, { title });
    },
    [promptHistory]
  );

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
        addKeyframe({ url: imageUrl, source: 'upload' });
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
  const activeModelLabel = selectedModel?.trim() ? selectedModel.trim() : 'Default';
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

  const effectiveAspectRatio = useMemo(() => {
    const fromParams = generationParams?.aspect_ratio;
    if (typeof fromParams === 'string' && fromParams.trim()) {
      return fromParams.trim();
    }
    return '16:9';
  }, [generationParams?.aspect_ratio]);

  const durationSeconds = useMemo(() => {
    const durationValue = generationParams?.duration_s;
    if (typeof durationValue === 'number') {
      return Number.isFinite(durationValue) ? durationValue : 5;
    }
    if (typeof durationValue === 'string') {
      const parsed = Number.parseFloat(durationValue);
      return Number.isFinite(parsed) ? parsed : 5;
    }
    return 5;
  }, [generationParams?.duration_s]);

  const handleAspectRatioChange = useCallback(
    (ratio: string): void => {
      if (generationParams?.aspect_ratio === ratio) return;
      setGenerationParams({ ...(generationParams ?? {}), aspect_ratio: ratio });
    },
    [generationParams, setGenerationParams]
  );

  const handleDurationChange = useCallback(
    (nextDuration: number): void => {
      if (generationParams?.duration_s === nextDuration) return;
      setGenerationParams({ ...(generationParams ?? {}), duration_s: nextDuration });
    },
    [generationParams, setGenerationParams]
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
    }),
    [generationParams, cameraMotion?.id]
  );

  // Prompt optimization
  const { handleOptimize } = usePromptOptimization({
    promptOptimizer,
    promptHistory,
    promptContext,
    selectedMode,
    selectedModel,
    generationParams: optimizationGenerationParams,
    startImageUrl: i2vContext.startImageUrl,
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

  const handleApplyCoherenceFix = useCallback(
    (recommendation: CoherenceRecommendation, issue: CoherenceIssue): boolean => {
      const currentPrompt = promptOptimizer.displayedPrompt;
      if (!currentPrompt) {
        return false;
      }

      const result = applyCoherenceRecommendation({
        recommendation,
        prompt: currentPrompt,
        spans: issue.spans,
        highlightSnapshot: latestHighlightRef.current,
      });

      if (!result.updatedPrompt) {
        return false;
      }

      if (result.updatedSnapshot) {
        applyInitialHighlightSnapshot(result.updatedSnapshot, {
          bumpVersion: true,
          markPersisted: false,
        });
      }

      handleDisplayedPromptChange(result.updatedPrompt);

      if (currentPromptUuid) {
        try {
          promptHistory.updateEntryOutput(currentPromptUuid, currentPromptDocId, result.updatedPrompt);
        } catch (error) {
          const info = sanitizeError(error);
          log.warn('Failed to persist coherence edits', {
            operation: 'updateEntryOutput',
            promptUuid: currentPromptUuid,
            promptDocId: currentPromptDocId,
            error: info.message,
            errorName: info.name,
          });
        }
      }

      return true;
    },
    [
      applyInitialHighlightSnapshot,
      currentPromptDocId,
      currentPromptUuid,
      handleDisplayedPromptChange,
      latestHighlightRef,
      promptHistory,
      promptOptimizer.displayedPrompt,
    ]
  );

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
  } = useCoherenceAnnotations({
    onApplyFix: handleApplyCoherenceFix,
    toast,
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
    createNew: handleCreateNew,
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

  return (
    <AppShell
      showHistory={showHistory}
      onToggleHistory={setShowHistory}
      history={promptHistory.history}
      filteredHistory={promptHistory.filteredHistory}
      isLoadingHistory={promptHistory.isLoadingHistory}
      searchQuery={promptHistory.searchQuery}
      onSearchChange={promptHistory.setSearchQuery}
      onLoadFromHistory={loadFromHistory}
      onCreateNew={handleCreateNew}
      onDelete={promptHistory.deleteFromHistory}
      onDuplicate={handleDuplicate}
      onRename={handleRename}
      currentPromptUuid={currentPromptUuid}
      currentPromptDocId={currentPromptDocId}
      activeStatusLabel={activeStatusLabel}
      activeModelLabel={activeModelLabel}
      prompt={promptForGeneration}
      onPromptChange={handleSidebarPromptChange}
      onOptimize={handleSidebarOptimize}
      showResults={showResults}
      isProcessing={promptOptimizer.isProcessing}
      isRefining={promptOptimizer.isRefining}
      genericOptimizedPrompt={promptOptimizer.genericOptimizedPrompt ?? null}
      promptInputRef={promptInputRef}
      onCreateFromTrigger={handleCreateFromTrigger}
      aspectRatio={effectiveAspectRatio}
      duration={durationSeconds}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      onAspectRatioChange={handleAspectRatioChange}
      onDurationChange={handleDurationChange}
      onDraft={handleDraft}
      onRender={handleRender}
      isDraftDisabled={!promptForGeneration.trim() || !isGenerationReady || isGenerating}
      isRenderDisabled={!promptForGeneration.trim() || !isGenerationReady || isGenerating}
      keyframes={keyframes}
      onAddKeyframe={addKeyframe}
      onRemoveKeyframe={removeKeyframe}
      onClearKeyframes={clearKeyframes}
      tier={videoTier}
      onTierChange={setVideoTier}
      onStoryboard={handleStoryboard}
      onImageUpload={handleImageUpload}
      activeDraftModel={generationControls?.activeDraftModel ?? null}
      showMotionControls={mode === 'create'}
      cameraMotion={cameraMotion}
      onCameraMotionChange={setCameraMotion}
      subjectMotion={subjectMotion}
      onSubjectMotionChange={setSubjectMotion}
      assets={assetsSidebar.assets}
      assetsByType={assetsSidebar.byType}
      isLoadingAssets={assetsSidebar.isLoading}
      onInsertTrigger={insertTriggerAtCursor}
      onEditAsset={handleEditAsset}
      onCreateAsset={handleCreateAsset}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden font-sans text-foreground">
        {/* Skip to main content */}
        <a href="#main-content" className="ps-skip-link">
          Skip to main content
        </a>

        {/* Modals */}
        <PromptModals
          onImprovementComplete={handleImprovementComplete}
          onConceptComplete={handleConceptComplete}
          onSkipBrainstorm={handleSkipBrainstorm}
        />
        <QuickCharacterCreate
          isOpen={quickCreateState.isOpen}
          prefillTrigger={quickCreateState.prefillTrigger}
          onClose={closeQuickCreate}
          onCreate={handleQuickCreateComplete}
        />
        {assetEditorState && (
          <AssetEditor
            mode={assetEditorState.mode}
            asset={assetEditorState.asset || undefined}
            preselectedType={assetEditorState.preselectedType || undefined}
            onClose={closeAssetEditor}
            onCreate={handleAssetCreate}
            onUpdate={handleAssetUpdate}
            onAddImage={handleAddAssetImage}
            onDeleteImage={handleDeleteAssetImage}
            onSetPrimaryImage={handleSetPrimaryAssetImage}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DetectedAssets
            prompt={promptForAssets}
            assets={assetsSidebar.assets}
            onEditAsset={handleEditAsset}
            onCreateFromTrigger={handleCreateFromTrigger}
          />

          {shouldShowLoading ? (
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" id="main-content">
              <div className="flex flex-1 items-center justify-center px-6 py-9 sm:px-8 sm:py-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-border-strong" />
                  <p className="text-body-sm text-muted">Loading prompt...</p>
                </div>
              </div>
            </main>
          ) : (
            <PromptResultsLayout
              user={user}
              onDisplayedPromptChange={handleDisplayedPromptChangeWithAutosave}
              onReoptimize={handleOptimize}
              onFetchSuggestions={fetchEnhancementSuggestions}
              onSuggestionClick={handleSuggestionClick}
              onHighlightsPersist={handleHighlightsPersist}
              onUndo={handleUndo}
              onRedo={handleRedo}
              stablePromptContext={stablePromptContext}
              suggestionsData={suggestionsData}
              displayedPrompt={promptOptimizer.displayedPrompt}
              coherenceAffectedSpanIds={affectedSpanIds}
              coherenceSpanIssueMap={spanIssueMap}
              coherenceIssues={coherenceIssues}
              isCoherenceChecking={isCoherenceChecking}
              isCoherencePanelExpanded={isPanelExpanded}
              onToggleCoherencePanelExpanded={() => setIsPanelExpanded(!isPanelExpanded)}
              onDismissCoherenceIssue={dismissIssue}
              onDismissAllCoherenceIssues={dismissAll}
              onApplyCoherenceFix={applyFix}
              onScrollToCoherenceSpan={scrollToSpanById}
              i2vContext={i2vContext}
            />
          )}
        </div>

        {/* Debug Button - Hidden */}
        {false && (import.meta.env.DEV ||
          new URLSearchParams(window.location.search).get('debug') === 'true') && (
          <DebugButton
            inputPrompt={promptOptimizer.inputPrompt}
            displayedPrompt={promptOptimizer.displayedPrompt}
            optimizedPrompt={promptOptimizer.optimizedPrompt}
            selectedMode={selectedMode}
            promptContext={stablePromptContext}
          />
        )}
      </div>
    </AppShell>
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
  const [user, setUser] = React.useState<User | null>(null);

  // Listen for auth state changes
  React.useEffect(() => {
    const authRepository = getAuthRepository();
    const unsubscribe = authRepository.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <PromptStateProvider user={user}>
      <PromptOptimizerContent user={user} convergenceHandoff={convergenceHandoff} mode={mode} />
    </PromptStateProvider>
  );
}

export default PromptOptimizerWorkspace;
