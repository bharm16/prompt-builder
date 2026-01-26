/**
 * PromptOptimizerContainer - Main Orchestrator
 *
 * Refactored to delegate business logic to specialized hooks.
 * This component focuses on:
 * - Coordinating hooks
 * - Rendering UI sections
 * - Wiring event handlers
 */

import React, { useCallback, useMemo } from 'react';
import { AppShell } from '@components/navigation/AppShell';
import DebugButton from '@components/DebugButton';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { useToast } from '@components/Toast';
import { getAuthRepository } from '@/repositories';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { PromptHistoryEntry } from '@hooks/types';
import type { CoherenceRecommendation } from '../types/coherence';
import type { User } from '../context/types';
import {
  useCoherenceAnnotations,
  type CoherenceIssue,
} from '../components/coherence/useCoherenceAnnotations';
import { PromptModals } from '../components/PromptModals';
import { PromptResultsSection } from '../components/PromptResultsSection';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import { GenerationControlsProvider } from '../context/GenerationControlsContext';
import { applyCoherenceRecommendation } from '../utils/applyCoherenceRecommendation';
import { scrollToSpanById } from '../utils/scrollToSpanById';
import {
  usePromptLoader,
  useHighlightsPersistence,
  useUndoRedo,
  usePromptOptimization,
  useImprovementFlow,
  useConceptBrainstorm,
  useEnhancementSuggestions,
} from './hooks';

const log = logger.child('PromptOptimizerContainer');

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

  const activeStatusLabel = resolveActiveStatusLabel({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    hasHighlights: Boolean(initialHighlights),
  });
  const activeModelLabel = selectedModel?.trim() ? selectedModel.trim() : 'Default';

  // Prompt optimization
  const { handleOptimize } = usePromptOptimization({
    promptOptimizer,
    promptHistory,
    promptContext,
    selectedMode,
    selectedModel,
    generationParams,
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
    generationParams,
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
      handleCreateNew();
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
      onLoadFromHistory={loadFromHistory}
      onCreateNew={handleCreateNew}
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
  const [user, setUser] = React.useState<User | null>(null);

  // Listen for auth state changes
  React.useEffect(() => {
    debug.logEffect('Auth state listener initialized');
    const authRepository = getAuthRepository();
    const unsubscribe = authRepository.onAuthStateChanged((currentUser) => {
      debug.logAction('authStateChanged', { 
        authenticated: !!currentUser,
        userId: currentUser?.uid 
      });
      setUser(currentUser);
    });
    return () => {
      debug.logEffect('Auth state listener cleanup');
      unsubscribe();
    };
  }, []);

  return (
    <PromptStateProvider user={user}>
      <GenerationControlsProvider>
        <PromptOptimizerContent user={user} />
      </GenerationControlsProvider>
    </PromptStateProvider>
  );
}

export default PromptOptimizerContainer;
