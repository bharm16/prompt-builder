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
import DebugButton from '../../../components/DebugButton';
import { useToast } from '../../../components/Toast';
import { useKeyboardShortcuts } from '../../../components/KeyboardShortcuts';
import { getAuthRepository } from '../../../repositories';
import {
  usePromptLoader,
  useHighlightsPersistence,
  useUndoRedo,
  usePromptOptimization,
  useImprovementFlow,
  useConceptBrainstorm,
  useEnhancementSuggestions,
} from './hooks';

/**
 * Inner component with access to PromptStateContext
 */
function PromptOptimizerContent({ user }) {
  // Force light mode immediately
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const toast = useToast();
  const {
    // State
    selectedMode,
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

    // Refs
    latestHighlightRef,
    persistedSignatureRef,
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

  const aiNames = ['Claude AI', 'ChatGPT', 'Gemini'];

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
  usePromptLoader({
    uuid,
    currentPromptUuid,
    navigate,
    toast,
    promptOptimizer,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    setCurrentPromptDocId,
    setCurrentPromptUuid,
    setShowResults,
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
    undoStackRef,
    redoStackRef,
    latestHighlightRef,
    isApplyingHistoryRef,
  });

  // Prompt optimization
  const { handleOptimize } = usePromptOptimization({
    promptOptimizer,
    promptHistory,
    promptContext,
    selectedMode,
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

  // Enhancement suggestions
  const { fetchEnhancementSuggestions, handleSuggestionClick } = useEnhancementSuggestions({
    promptOptimizer,
    selectedMode,
    suggestionsData,
    setSuggestionsData,
    setDisplayedPromptSilently,
    stablePromptContext,
    toast,
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
    canCopy: () => showResults && promptOptimizer.displayedPrompt,
    copy: () => {
      navigator.clipboard.writeText(promptOptimizer.displayedPrompt);
      toast.success('Copied to clipboard!');
    },
    export: () => showResults && toast.info('Use export button in canvas'),
    toggleSidebar: () => setShowHistory(!showHistory),
    switchMode: (index) => {
      // Implementation from original
    },
    applySuggestion: (index) => {
      if (suggestionsData?.suggestions[index]) {
        handleSuggestionClick(suggestionsData.suggestions[index]);
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
  return (
    <div
      className="h-screen overflow-hidden gradient-neutral transition-colors duration-300"
      style={{ '--sidebar-width': showHistory ? '18rem' : '0px' }}
    >
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only-focusable top-4 left-4">
        Skip to main content
      </a>

      {/* Modals */}
      <PromptModals
        onImprovementComplete={handleImprovementComplete}
        onConceptComplete={handleConceptComplete}
        onSkipBrainstorm={handleSkipBrainstorm}
      />

      {/* Top Action Buttons */}
      <PromptTopBar />

      {/* History Sidebar */}
      <PromptSidebar user={user} />

      {/* Main Content */}
      <main
        id="main-content"
        className={`relative flex h-screen flex-col items-center px-4 sm:px-6 py-8 transition-all duration-300 ${showHistory ? 'ml-72' : 'ml-0'} ${showResults ? 'justify-start' : 'justify-center overflow-y-auto'}`}
      >
        {/* Input Section */}
        {!showResults && (
          <PromptInputSection
            aiNames={aiNames}
            onOptimize={handleOptimize}
            onShowBrainstorm={() => setShowBrainstorm(true)}
          />
        )}

        {/* Results Section */}
        <PromptResultsSection
          onDisplayedPromptChange={handleDisplayedPromptChange}
          onFetchSuggestions={fetchEnhancementSuggestions}
          onHighlightsPersist={handleHighlightsPersist}
          onUndo={handleUndo}
          onRedo={handleRedo}
          stablePromptContext={stablePromptContext}
        />

        {/* Privacy Policy Footer */}
        {!showResults && (
          <footer className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <a
              href="/privacy-policy"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Privacy Policy
            </a>
          </footer>
        )}
      </main>

      {/* Debug Button */}
      {(process.env.NODE_ENV === 'development' ||
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
function PromptOptimizerContainer() {
  const [user, setUser] = React.useState(null);

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
      <PromptOptimizerContent user={user} />
    </PromptStateProvider>
  );
}

export default PromptOptimizerContainer;

