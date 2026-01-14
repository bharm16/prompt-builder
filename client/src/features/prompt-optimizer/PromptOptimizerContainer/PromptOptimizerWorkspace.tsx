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
import { useLocation } from 'react-router-dom';
import { usePromptState, PromptStateProvider } from '../context/PromptStateContext';
import { PromptInputLayout } from '../layouts/PromptInputLayout';
import { PromptResultsLayout } from '../layouts/PromptResultsLayout';
import { PromptModals } from '../components/PromptModals';
import { PromptTopBar } from '../components/PromptTopBar';
import { PromptSidebar } from '../components/PromptSidebar';
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

  const location = useLocation();

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
    setOutputSaveState,
    setOutputLastSavedAt,

    // Navigation
    navigate,
    uuid,
  } = usePromptState();

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
  const isPromptRoute = location.pathname.startsWith('/prompt/');
  const shouldShowLoading = isLoading || (isPromptRoute && !showResults);

  return (
    <div
      className="prompt-optimizer-workspace"
      style={{
        '--sidebar-width': showHistory
          ? 'var(--layout-sidebar-width-expanded)'
          : 'var(--layout-sidebar-width-collapsed)',
        transition: 'grid-template-columns 120ms cubic-bezier(0.2, 0, 0, 1)',
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
      {showResults && <PromptTopBar />}

      {/* Conditionally render the appropriate layout */}
      {showResults ? (
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
        />
      ) : shouldShowLoading ? (
        <div className="prompt-input-layout">
          <PromptSidebar user={user} />
          <main className="prompt-input-layout__main" id="main-content">
            <div className="prompt-input-layout__content">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-600"></div>
                <p className="text-neutral-500 text-sm">Loading prompt...</p>
              </div>
            </div>
          </main>
        </div>
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
