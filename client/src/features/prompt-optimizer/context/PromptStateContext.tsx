/**
 * PromptStateContext - Centralized State Management for Prompt Optimizer
 *
 * Replaces massive prop drilling in PromptOptimizerContainer
 * Manages all prompt-related state in one place
 */

import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Video } from 'lucide-react';
import { usePromptOptimizer } from '@hooks/usePromptOptimizer';
import { usePromptHistory } from '@hooks/usePromptHistory';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { PromptVersionEdit } from '@hooks/types';
import type { CapabilityValues } from '@shared/capabilities';
import type {
  PromptStateContextValue,
  PromptStateProviderProps,
  HighlightSnapshot,
  Mode,
  StateSnapshot,
} from './types';
import type { SuggestionsData } from '../PromptCanvas/types';
import { usePromptHistoryActions } from './usePromptHistoryActions';
import { loadGenerationParams, loadSelectedModel } from './promptStateStorage';
import { useDraftHistorySync } from './hooks/useDraftHistorySync';
import { usePromptStatePersistence } from './hooks/usePromptStatePersistence';

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
      icon: Video,
      description: 'Generate AI video prompts',
    },
  ], []);

  // UI State
  const [selectedMode, setSelectedMode] = useState<string>('video');
  const [selectedModel, setSelectedModel] = useState<string>(() => loadSelectedModel()); // New: selected video model (persisted)
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [showImprover, setShowImprover] = useState<boolean>(false);
  const [showBrainstorm, setShowBrainstorm] = useState<boolean>(false);
  const [currentAIIndex, setCurrentAIIndex] = useState<number>(0);
  const [generationParams, setGenerationParams] = useState<CapabilityValues>(() => loadGenerationParams());
  const [outputSaveState, setOutputSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [outputLastSavedAt, setOutputLastSavedAt] = useState<number | null>(null);

  // Enhancement suggestions state
  const [suggestionsData, setSuggestionsData] = useState<SuggestionsData | null>(null);
  const [conceptElements, setConceptElements] = useState<unknown | null>(null);
  const [promptContext, setPromptContext] = useState<PromptContext | null>(null);
  const [currentPromptUuid, setCurrentPromptUuid] = useState<string | null>(null);
  const [currentPromptDocId, setCurrentPromptDocId] = useState<string | null>(null);
  const [initialHighlights, setInitialHighlights] = useState<HighlightSnapshot | null>(null);
  const [initialHighlightsVersion, setInitialHighlightsVersion] = useState<number>(0);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Refs
  const latestHighlightRef = useRef<HighlightSnapshot | null>(null);
  const persistedSignatureRef = useRef<string | null>(null);
  const versionEditCountRef = useRef<number>(0);
  const versionEditsRef = useRef<PromptVersionEdit[]>([]);
  const undoStackRef = useRef<StateSnapshot[]>([]);
  const redoStackRef = useRef<StateSnapshot[]>([]);
  const isApplyingHistoryRef = useRef<boolean>(false);
  const skipLoadFromUrlRef = useRef<boolean>(false);

  const registerPromptEdit = useCallback(
    ({
      previousText,
      nextText,
      source = 'unknown',
    }: {
      previousText: string;
      nextText: string;
      source?: PromptVersionEdit['source'];
    }): void => {
      if (previousText === nextText) return;
      versionEditCountRef.current += 1;
      versionEditsRef.current.push({
        timestamp: new Date().toISOString(),
        delta: nextText.length - previousText.length,
        source,
      });
      if (versionEditsRef.current.length > 50) {
        versionEditsRef.current.shift();
      }
    },
    []
  );

  const resetVersionEdits = useCallback((): void => {
    versionEditCountRef.current = 0;
    versionEditsRef.current = [];
  }, []);

  // Custom hooks
  const promptOptimizer = usePromptOptimizer(selectedMode, selectedModel);
  const promptHistory = usePromptHistory(user);

  const currentMode: Mode = useMemo(
    () => modes.find((m) => m.id === selectedMode) || modes[0]!,
    [modes, selectedMode]
  );

  // Helper functions
  const applyInitialHighlightSnapshot = useCallback((
    snapshot: HighlightSnapshot | null,
    { bumpVersion = false, markPersisted = false }: { bumpVersion?: boolean; markPersisted?: boolean } = {}
  ): void => {
    setInitialHighlights(snapshot ?? null);
    if (bumpVersion) {
      setInitialHighlightsVersion((prev) => prev + 1);
    }
    latestHighlightRef.current = snapshot ?? null;
    if (markPersisted) {
      persistedSignatureRef.current = snapshot?.signature ?? null;
    }
  }, []);

  const resetEditStacks = useCallback((): void => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

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
  const value: PromptStateContextValue = {
    // Mode
    modes,
    selectedMode,
    setSelectedMode,
    currentMode,
    selectedModel, // New
    setSelectedModel, // New
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
  };

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
