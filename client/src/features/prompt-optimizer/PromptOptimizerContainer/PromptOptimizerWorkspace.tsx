/**
 * PromptOptimizerWorkspace - Main Orchestrator
 *
 * Coordinates business logic and conditionally renders the appropriate layout:
 * - PromptInputLayout: For input view (when showResults is false)
 * - PromptResultsLayout: For results/canvas view (when showResults is true)
 *
 * This component focuses on:
 * - Coordinating hooks
 * - Business logic delegation
 * - Conditional layout rendering
 */

import React, { useMemo } from 'react';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import { PromptInputLayout } from '../layouts/PromptInputLayout';
import { PromptResultsLayout } from '../layouts/PromptResultsLayout';
import { PromptModals } from '../components/PromptModals';
import { PromptTopBar } from '../components/PromptTopBar';
import DebugButton from '@components/DebugButton';
import { useToast } from '@components/Toast';
import { useKeyboardShortcuts } from '@components/KeyboardShortcuts';
import { getAuthRepository } from '@/repositories';
import './PromptOptimizerWorkspace.css';
import {
  usePromptLoader,
  useHighlightsPersistence,
  useUndoRedo,
  usePromptOptimization,
  useImprovementFlow,
  useConceptBrainstorm,
  useEnhancementSuggestions,
} from './hooks';
import type { User } from '../context/types';

/**
 * Inner component with access to PromptStateContext
 */
function PromptOptimizerContent({ user }: { user: User | null }): React.ReactElement {
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
    setCanUndo,
    setCanRedo,

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
    setCanUndo,
    setCanRedo,
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
    handleDisplayedPromptChange,
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
      if (suggestionsData && typeof suggestionsData === 'object' && 'suggestions' in suggestionsData) {
        const suggestions = (suggestionsData as { suggestions: unknown[] }).suggestions;
        if (suggestions[index]) {
          handleSuggestionClick(suggestions[index]);
        }
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
      className="prompt-optimizer-workspace"
      style={{
        '--sidebar-width': showHistory
          ? 'var(--layout-sidebar-width-expanded)'
          : 'var(--layout-sidebar-width-collapsed)',
      } as React.CSSProperties}
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

      {/* Conditionally render the appropriate layout */}
      {showResults ? (
        <PromptResultsLayout
          user={user}
          onDisplayedPromptChange={handleDisplayedPromptChange}
          onFetchSuggestions={fetchEnhancementSuggestions}
          onSuggestionClick={handleSuggestionClick}
          onHighlightsPersist={handleHighlightsPersist}
          onUndo={handleUndo}
          onRedo={handleRedo}
          stablePromptContext={stablePromptContext}
          suggestionsData={suggestionsData}
        />
      ) : (
        <PromptInputLayout
          user={user}
          aiNames={aiNames}
          onOptimize={handleOptimize}
          onShowBrainstorm={() => setShowBrainstorm(true)}
        />
      )}

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
function PromptOptimizerWorkspace(): React.ReactElement {
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
      <PromptOptimizerContent user={user} />
    </PromptStateProvider>
  );
}

export default PromptOptimizerWorkspace;

