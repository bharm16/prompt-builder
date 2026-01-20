/**
 * PromptStateContext - Centralized State Management for Prompt Optimizer
 *
 * Replaces massive prop drilling in PromptOptimizerContainer
 * Manages all prompt-related state in one place
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VideoCamera } from '@promptstudio/system/components/ui';
import { usePromptOptimizer } from '@hooks/usePromptOptimizer';
import { usePromptHistory } from '@hooks/usePromptHistory';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type {
  PromptStateContextValue,
  PromptStateProviderProps,
  Mode,
} from './types';
import { usePromptHistoryActions } from './usePromptHistoryActions';
import { useDraftHistorySync } from './hooks/useDraftHistorySync';
import { usePromptStatePersistence } from './hooks/usePromptStatePersistence';
import { usePromptConfigState } from './hooks/usePromptConfigState';
import { usePromptUiState } from './hooks/usePromptUiState';
import { usePromptSessionState } from './hooks/usePromptSessionState';
import { useHighlightState } from './hooks/useHighlightState';
import { useVersionEditTracking } from './hooks/useVersionEditTracking';
import { useHistoryActionRefs } from './hooks/useHistoryActionRefs';

const PromptStateContext = createContext<PromptStateContextValue | null>(null);

/**
 * Hook to use prompt state
 */
export function usePromptState(): PromptStateContextValue {
  const context = useContext(PromptStateContext);
  if (!context) {
    throw new Error('usePromptState must be used within PromptStateProvider');
  }
  return context;
}

/**
 * Prompt State Provider
 */
export function PromptStateProvider({ children, user }: PromptStateProviderProps): React.ReactElement {
  const debug = useDebugLogger('PromptStateProvider', { 
    user: user ? 'authenticated' : 'anonymous' 
  });
  const navigate = useNavigate();
  const { uuid } = useParams<{ uuid?: string }>();

  // Mode configuration (video-only)
  const modes: Mode[] = useMemo(() => [
    {
      id: 'video',
      name: 'Video Prompt',
      icon: VideoCamera,
      description: 'Generate AI video prompts',
    },
  ], []);

  const {
    selectedMode,
    setSelectedMode,
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
  } = usePromptConfigState();

  const {
    showHistory,
    setShowHistory,
    showResults,
    setShowResults,
    showSettings,
    setShowSettings,
    showShortcuts,
    setShowShortcuts,
    showImprover,
    setShowImprover,
    showBrainstorm,
    setShowBrainstorm,
    currentAIIndex,
    setCurrentAIIndex,
    outputSaveState,
    setOutputSaveState,
    outputLastSavedAt,
    setOutputLastSavedAt,
  } = usePromptUiState();

  const {
    suggestionsData,
    setSuggestionsData,
    conceptElements,
    setConceptElements,
    promptContext,
    setPromptContext,
    currentPromptUuid,
    setCurrentPromptUuid,
    currentPromptDocId,
    setCurrentPromptDocId,
    activeVersionId,
    setActiveVersionId,
  } = usePromptSessionState();

  const {
    initialHighlights,
    setInitialHighlights,
    initialHighlightsVersion,
    setInitialHighlightsVersion,
    canUndo,
    setCanUndo,
    canRedo,
    setCanRedo,
    latestHighlightRef,
    persistedSignatureRef,
    undoStackRef,
    redoStackRef,
    applyInitialHighlightSnapshot,
    resetEditStacks,
  } = useHighlightState();

  const { versionEditCountRef, versionEditsRef, registerPromptEdit, resetVersionEdits } =
    useVersionEditTracking();

  const { isApplyingHistoryRef, skipLoadFromUrlRef } = useHistoryActionRefs();

  // Custom hooks
  const promptOptimizer = usePromptOptimizer(selectedMode, selectedModel);
  const promptHistory = usePromptHistory(user);

  const currentMode: Mode = useMemo(
    () => modes.find((m) => m.id === selectedMode) || modes[0]!,
    [modes, selectedMode]
  );

  const { setDisplayedPromptSilently, handleCreateNew, loadFromHistory } = usePromptHistoryActions({
    debug,
    navigate,
    promptOptimizer,
    promptHistory,
    selectedMode,
    selectedModel,
    generationParams,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    resetVersionEdits,
    setSuggestionsData,
    setConceptElements,
    setPromptContext,
    setGenerationParams,
    setSelectedMode,
    setSelectedModel,
    setShowResults,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    persistedSignatureRef,
    isApplyingHistoryRef,
    skipLoadFromUrlRef,
  });

  // Context value
  const value: PromptStateContextValue = useMemo(() => ({
    // Mode
    modes,
    selectedMode,
    setSelectedMode,
    currentMode,
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,

    // UI State
    showHistory,
    setShowHistory,
    showResults,
    setShowResults,
    showSettings,
    setShowSettings,
    showShortcuts,
    setShowShortcuts,
    showImprover,
    setShowImprover,
    showBrainstorm,
    setShowBrainstorm,
    currentAIIndex,
    setCurrentAIIndex,
    outputSaveState,
    setOutputSaveState,
    outputLastSavedAt,
    setOutputLastSavedAt,

    // Prompt State
    suggestionsData,
    setSuggestionsData,
    conceptElements,
    setConceptElements,
    promptContext,
    setPromptContext,
    currentPromptUuid,
    setCurrentPromptUuid,
    currentPromptDocId,
    setCurrentPromptDocId,
    activeVersionId,
    setActiveVersionId,

    // Highlights
    initialHighlights,
    setInitialHighlights,
    initialHighlightsVersion,
    setInitialHighlightsVersion,
    canUndo,
    setCanUndo,
    canRedo,
    setCanRedo,

    // Refs
    latestHighlightRef,
    persistedSignatureRef,
    versionEditCountRef,
    versionEditsRef,
    undoStackRef,
    redoStackRef,
    isApplyingHistoryRef,
    skipLoadFromUrlRef,

    // Hooks
    promptOptimizer,
    promptHistory,

    // Helper functions
    applyInitialHighlightSnapshot,
    resetEditStacks,
    registerPromptEdit,
    resetVersionEdits,
    setDisplayedPromptSilently,
    handleCreateNew,
    loadFromHistory,

    // Navigation
    navigate,
    uuid,
  }), [
    modes,
    selectedMode,
    currentMode,
    selectedModel,
    generationParams,
    showHistory,
    showResults,
    showSettings,
    showShortcuts,
    showImprover,
    showBrainstorm,
    currentAIIndex,
    outputSaveState,
    outputLastSavedAt,
    suggestionsData,
    conceptElements,
    promptContext,
    currentPromptUuid,
    currentPromptDocId,
    activeVersionId,
    initialHighlights,
    initialHighlightsVersion,
    canUndo,
    canRedo,
    promptOptimizer,
    promptHistory,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    registerPromptEdit,
    resetVersionEdits,
    setDisplayedPromptSilently,
    handleCreateNew,
    loadFromHistory,
    navigate,
    uuid,
  ]);

  usePromptStatePersistence({ selectedModel, generationParams });
  useDraftHistorySync({
    currentPromptUuid,
    currentPromptDocId,
    promptHistory,
    promptOptimizer,
    selectedModel,
    generationParams,
  });

  return <PromptStateContext.Provider value={value}>{children}</PromptStateContext.Provider>;
}
