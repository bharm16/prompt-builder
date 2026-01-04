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
import { PromptContext } from '@utils/PromptContext/PromptContext';
import type { CapabilityValues } from '@shared/capabilities';
import { createHighlightSignature } from '@/features/span-highlighting';
import type {
  PromptStateContextValue,
  PromptStateProviderProps,
  HighlightSnapshot,
  Mode,
  PromptHistoryEntry,
  StateSnapshot,
} from './types';
import type { SuggestionsData } from '../PromptCanvas/types';

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
  const [selectedModel, setSelectedModel] = useState<string>(''); // New: selected video model
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [showImprover, setShowImprover] = useState<boolean>(false);
  const [showBrainstorm, setShowBrainstorm] = useState<boolean>(false);
  const [currentAIIndex, setCurrentAIIndex] = useState<number>(0);
  const [generationParams, setGenerationParams] = useState<CapabilityValues>({});

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
  const undoStackRef = useRef<StateSnapshot[]>([]);
  const redoStackRef = useRef<StateSnapshot[]>([]);
  const isApplyingHistoryRef = useRef<boolean>(false);
  const skipLoadFromUrlRef = useRef<boolean>(false);

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

  const setDisplayedPromptSilently = useCallback((text: string): void => {
    isApplyingHistoryRef.current = true;
    promptOptimizer.setDisplayedPrompt(text);
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [promptOptimizer]);

  // Create new prompt
  const handleCreateNew = useCallback((): void => {
    debug.logAction('createNew');
    skipLoadFromUrlRef.current = true;
    promptOptimizer.resetPrompt();
    setShowResults(false);
    setSuggestionsData(null);
    setConceptElements(null);
    setPromptContext(null);
    setGenerationParams({});
    setCurrentPromptUuid(null);
    setCurrentPromptDocId(null);
    applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
    persistedSignatureRef.current = null;
    resetEditStacks();
    navigate('/', { replace: true });
    debug.logAction('createNewComplete');
  }, [promptOptimizer, navigate, applyInitialHighlightSnapshot, resetEditStacks]);

  // Load from history
  const loadFromHistory = useCallback((entry: PromptHistoryEntry): void => {
    debug.logAction('loadFromHistory', { 
      uuid: entry.uuid, 
      mode: entry.mode,
      hasContext: !!entry.brainstormContext,
      hasHighlightCache: !!entry.highlightCache
    });
    debug.startTimer('loadFromHistory');

    skipLoadFromUrlRef.current = true;
    setCurrentPromptUuid(entry.uuid || null);
    setCurrentPromptDocId(entry.id || null);

    promptOptimizer.setInputPrompt(entry.input);
    promptOptimizer.setOptimizedPrompt(entry.output);
    setDisplayedPromptSilently(entry.output);
    if (promptOptimizer.setPreviewPrompt) {
      promptOptimizer.setPreviewPrompt(null);
    }
    if (promptOptimizer.setPreviewAspectRatio) {
      promptOptimizer.setPreviewAspectRatio(null);
    }
    setSelectedMode('video');
    setSelectedModel(typeof entry.targetModel === 'string' ? entry.targetModel : '');
    setGenerationParams({});
    setShowResults(true);

    const preloadedHighlight: HighlightSnapshot | null = entry.highlightCache
      ? {
          ...(entry.highlightCache as Record<string, unknown>),
          signature: (entry.highlightCache as { signature?: string })?.signature ?? createHighlightSignature(entry.output ?? ''),
        } as HighlightSnapshot
      : null;

    applyInitialHighlightSnapshot(preloadedHighlight, { bumpVersion: true, markPersisted: true });
    resetEditStacks();

    if (entry.brainstormContext) {
      try {
        const contextData =
          typeof entry.brainstormContext === 'string'
            ? JSON.parse(entry.brainstormContext)
            : entry.brainstormContext;
        const restoredContext = PromptContext.fromJSON(contextData);
        setPromptContext(restoredContext);
        debug.logAction('contextRestored');
      } catch (contextError) {
        debug.logError('Failed to restore prompt context from history entry', contextError as Error);
        setPromptContext(null);
      }
    } else {
      setPromptContext(null);
    }

    if (entry.uuid) {
      navigate(`/prompt/${entry.uuid}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skipLoadFromUrlRef.current = false;
        debug.endTimer('loadFromHistory', 'History entry loaded');
      });
    });
  }, [promptOptimizer, setDisplayedPromptSilently, applyInitialHighlightSnapshot, resetEditStacks, navigate, setSelectedModel]);

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
    setDisplayedPromptSilently,
    handleCreateNew,
    loadFromHistory,

    // Navigation
    navigate,
    uuid,
  };

  return <PromptStateContext.Provider value={value}>{children}</PromptStateContext.Provider>;
}
