/**
 * PromptOptimizerContainer - Main Orchestrator
 *
 * Refactored to delegate business logic to specialized hooks.
 * This component focuses on:
 * - Coordinating hooks
 * - Rendering UI sections
 * - Wiring event handlers
 */

import React, { useMemo } from 'react';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import { PromptInputSection } from '../components/PromptInputSection';
import { PromptResultsSection } from '../components/PromptResultsSection';
import { PromptModals } from '../components/PromptModals';
import { PromptTopBar } from '../components/PromptTopBar';
import { PromptSidebar } from '../components/PromptSidebar';
import { CoherenceReviewModal } from '../components/CoherenceReviewModal';
import DebugButton from '@components/DebugButton';
import { useToast } from '@components/Toast';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { getAuthRepository } from '@/repositories';
import { useDebugLogger } from '@hooks/useDebugLogger';
import {
  usePromptLoader,
  useHighlightsPersistence,
  useUndoRedo,
  usePromptOptimization,
  useImprovementFlow,
  useConceptBrainstorm,
  useEnhancementSuggestions,
  useCoherenceReview,
} from './hooks';
import type { User } from '../context/types';
import './PromptOptimizerContainer.css';

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

    // Navigation
    navigate,
    uuid,
  } = usePromptState();

  const aiNames = ['Claude AI', 'ChatGPT', 'Gemini'] as const;

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

  const {
    reviewData,
    isChecking: isCoherenceChecking,
    isApplying: isCoherenceApplying,
    runCoherenceCheck,
    applyRecommendations,
    dismissReview,
  } = useCoherenceReview({
    promptOptimizer,
    handleDisplayedPromptChange,
    applyInitialHighlightSnapshot,
    latestHighlightRef,
    toast,
    currentPromptUuid,
    currentPromptDocId,
    promptHistory,
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
    <div
      className="prompt-optimizer-shell relative h-full min-h-0 overflow-hidden gradient-neutral transition-colors duration-300"
      style={{
        '--sidebar-width': showHistory 
          ? 'var(--layout-sidebar-width-expanded)' 
          : 'var(--layout-sidebar-width-collapsed)',
        display: 'grid',
        gridTemplateColumns: `
          var(--sidebar-width) 
          minmax(0, 1fr)
        `,
        transition: 'grid-template-columns 120ms cubic-bezier(0.2, 0, 0, 1)',
      } as React.CSSProperties}
    >
      {/* Skip to main content - positioned absolute so it doesn't affect grid layout */}
      <a href="#main-content" className="sr-only-focusable absolute top-4 left-4 z-50">
        Skip to main content
      </a>

      {/* Modals */}
      <PromptModals
        onImprovementComplete={handleImprovementComplete}
        onConceptComplete={handleConceptComplete}
        onSkipBrainstorm={handleSkipBrainstorm}
      />

      <CoherenceReviewModal
        review={reviewData}
        isChecking={isCoherenceChecking}
        isApplying={isCoherenceApplying}
        onDismiss={dismissReview}
        onUndoOriginal={() => {
          handleUndo();
          dismissReview();
        }}
        onApplySelected={applyRecommendations}
      />

      {/* Top Action Buttons */}
      {showResults && <PromptTopBar />}

      {/* History Sidebar */}
      <PromptSidebar user={user} />

      {/* Main Content */}
      <main
        id="main-content"
        className="relative flex min-h-0 flex-col overflow-y-auto transition-all duration-300"
        style={{
          minWidth: 0, // Allows flex shrinking
        }}
      >
        {/* Input Section */}
        {!showResults && !isLoading && (
          <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
            <PromptInputSection
              aiNames={aiNames}
              onOptimize={handleOptimize}
              onShowBrainstorm={() => setShowBrainstorm(true)}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-600"></div>
              <p className="text-neutral-500 text-sm">Loading prompt...</p>
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
        />

        {/* Privacy Policy Footer */}
        {!showResults && (
          <footer className="mt-auto py-8 text-center">
            <a
              href="/privacy-policy"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Privacy Policy
            </a>
          </footer>
        )}
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
      <PromptOptimizerContent user={user} />
    </PromptStateProvider>
  );
}

export default PromptOptimizerContainer;
