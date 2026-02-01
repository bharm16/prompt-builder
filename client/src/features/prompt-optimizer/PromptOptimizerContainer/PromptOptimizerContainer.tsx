/**
 * PromptOptimizerContainer - Main Orchestrator
 *
 * Refactored to delegate business logic to specialized hooks.
 * This component focuses on:
 * - Coordinating hooks
 * - Rendering UI sections
 * - Wiring event handlers
 */

import React, { useMemo, useEffect } from 'react';
import { AppShell } from '@components/navigation/AppShell';
import DebugButton from '@components/DebugButton';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { useToast } from '@components/Toast';
import { logger } from '@/services/LoggingService';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { useAuthUser } from '@hooks/useAuthUser';
import type { User } from '../context/types';
import { PromptModals } from '../components/PromptModals';
import { PromptResultsSection } from '../components/PromptResultsSection';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import { GenerationControlsProvider, useGenerationControlsContext } from '../context/GenerationControlsContext';
import type { CapabilityValues } from '@shared/capabilities';
import { resolveActiveModelLabel, resolveActiveStatusLabel } from '../utils/activeStatusLabel';
import { scrollToSpanById } from '../utils/scrollToSpanById';
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

const log = logger.child('PromptOptimizerContainer');

/**
 * Inner component with access to PromptStateContext
 */
function PromptOptimizerContent({ user }: { user: User | null }): React.ReactElement {
  const debug = useDebugLogger('PromptOptimizerContent', { user: user ? 'authenticated' : 'anonymous' });

  // Force light mode immediately
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
    debug.logEffect('Light mode enforced');
  }, []);

  const toast = useToast();
  const {
    // State
    selectedMode,
    selectedModel,
    setSelectedModel,
    generationParams,
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

    // Navigation
    navigate,
    uuid,
  } = usePromptState();
  const { cameraMotion, keyframes, setKeyframes, subjectMotion } = useGenerationControlsContext();
  const i2vContext = useI2VContext();

  const stablePromptContext = useStablePromptContext(promptContext);

  const { serializedKeyframes, onLoadKeyframes } = usePromptKeyframesSync({
    keyframes,
    setKeyframes,
    currentPromptUuid,
    currentPromptDocId,
    promptHistory,
  });

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

  const activeStatusLabel = resolveActiveStatusLabel({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    hasHighlights: Boolean(initialHighlights),
  });
  const activeModelLabel = resolveActiveModelLabel(selectedModel);

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
    keyframes: serializedKeyframes,
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
    keyframes: serializedKeyframes,
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
    openShortcuts: () => {
      debug.logAction('openShortcuts');
      setShowShortcuts(true);
    },
    openSettings: () => {
      debug.logAction('openSettings');
      setShowSettings(true);
    },
    createNew: () => {
      debug.logAction('createNew');
      handleCreateNewWithKeyframes();
    },
    optimize: () => {
      if (!promptOptimizer.isProcessing && showResults === false) {
        debug.logAction('optimize', { mode: selectedMode });
        handleOptimize();
      }
    },
    improveFirst: () => {
      debug.logAction('improveFirst');
      handleImproveFirst();
    },
    canCopy: () => showResults && Boolean(promptOptimizer.displayedPrompt),
    copy: () => {
      debug.logAction('copy', { promptLength: promptOptimizer.displayedPrompt.length });
      navigator.clipboard.writeText(promptOptimizer.displayedPrompt);
      toast.success('Copied to clipboard!');
    },
    export: () => {
      debug.logAction('export');
      showResults && toast.info('Use export button in canvas');
    },
    toggleSidebar: () => {
      debug.logAction('toggleSidebar', { newState: !showHistory });
      setShowHistory(!showHistory);
    },
    switchMode: () => {
      debug.logAction('switchMode');
      // Implementation from original
    },
    applySuggestion: (index: number) => {
      const suggestion = suggestionsData?.suggestions?.[index];
      if (suggestion) {
        debug.logAction('applySuggestion', { index });
        handleSuggestionClick(suggestion);
      }
    },
    closeModal: () => {
      debug.logAction('closeModal');
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
  return (
    <AppShell
      showHistory={showHistory}
      onToggleHistory={setShowHistory}
      history={promptHistory.history}
      filteredHistory={promptHistory.filteredHistory}
      isLoadingHistory={promptHistory.isLoadingHistory}
      searchQuery={promptHistory.searchQuery}
      onSearchChange={promptHistory.setSearchQuery}
      onLoadFromHistory={handleLoadFromHistory}
      onCreateNew={handleCreateNewWithKeyframes}
      onDelete={promptHistory.deleteFromHistory}
      onDuplicate={handleDuplicate}
      onRename={handleRename}
      currentPromptUuid={currentPromptUuid}
      currentPromptDocId={currentPromptDocId}
      activeStatusLabel={activeStatusLabel}
      activeModelLabel={activeModelLabel}
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-foreground transition-colors duration-300">
        {/* Skip to main content - positioned absolute so it doesn't affect grid layout */}
        <a href="#main-content" className="ps-skip-link">
          Skip to main content
        </a>

        {/* Modals */}
        <PromptModals
          onImprovementComplete={handleImprovementComplete}
          onConceptComplete={handleConceptComplete}
          onSkipBrainstorm={handleSkipBrainstorm}
        />

        {/* Main Content */}
        <main
          id="main-content"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto transition-all duration-300"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-border-strong" />
                <p className="text-body-sm text-muted">Loading prompt...</p>
              </div>
            </div>
          )}

          {/* Results Section */}
          <PromptResultsSection
            user={user}
            onDisplayedPromptChange={handleDisplayedPromptChange}
            onReoptimize={handleOptimize}
            onFetchSuggestions={fetchEnhancementSuggestions}
            onSuggestionClick={handleSuggestionClick}
            onHighlightsPersist={handleHighlightsPersist}
            onUndo={handleUndo}
            onRedo={handleRedo}
            stablePromptContext={stablePromptContext}
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
        </main>

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
function PromptOptimizerContainer(): React.ReactElement {
  const debug = useDebugLogger('PromptOptimizerContainer');
  const user = useAuthUser({
    onInit: () => {
      debug.logEffect('Auth state listener initialized');
    },
    onCleanup: () => {
      debug.logEffect('Auth state listener cleanup');
    },
    onChange: (currentUser) => {
      debug.logAction('authStateChanged', {
        authenticated: !!currentUser,
        userId: currentUser?.uid,
      });
    },
  });

  return (
    <PromptStateProvider user={user}>
      <GenerationControlsProvider>
        <PromptOptimizerContent user={user} />
      </GenerationControlsProvider>
    </PromptStateProvider>
  );
}

export default PromptOptimizerContainer;
