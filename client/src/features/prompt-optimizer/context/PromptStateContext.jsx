/**
 * PromptStateContext - Centralized State Management for Prompt Optimizer
 *
 * Replaces massive prop drilling in PromptOptimizerContainer
 * Manages all prompt-related state in one place
 */

import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Video } from 'lucide-react';
import { getPromptRepository } from '../../../repositories';
import { usePromptOptimizer } from '../../../hooks/usePromptOptimizer';
import { usePromptHistory } from '../../../hooks/usePromptHistory';
import { PromptContext } from '../../../utils/PromptContext';
import { createHighlightSignature } from '../hooks/useSpanLabeling';

const PromptStateContext = createContext(null);

/**
 * Hook to use prompt state
 */
export const usePromptState = () => {
  const context = useContext(PromptStateContext);
  if (!context) {
    throw new Error('usePromptState must be used within PromptStateProvider');
  }
  return context;
};

/**
 * Prompt State Provider
 */
export const PromptStateProvider = ({ children, user }) => {
  const navigate = useNavigate();
  const { uuid } = useParams();

  // Mode configuration (video-only)
  const modes = useMemo(() => [
    {
      id: 'video',
      name: 'Video Prompt',
      icon: Video,
      description: 'Generate AI video prompts',
    },
  ], []);

  // UI State
  const [selectedMode, setSelectedMode] = useState('video');
  const [showHistory, setShowHistory] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImprover, setShowImprover] = useState(false);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [currentAIIndex, setCurrentAIIndex] = useState(0);

  // Enhancement suggestions state
  const [suggestionsData, setSuggestionsData] = useState(null);
  const [conceptElements, setConceptElements] = useState(null);
  const [promptContext, setPromptContext] = useState(null);
  const [currentPromptUuid, setCurrentPromptUuid] = useState(null);
  const [currentPromptDocId, setCurrentPromptDocId] = useState(null);
  const [initialHighlights, setInitialHighlights] = useState(null);
  const [initialHighlightsVersion, setInitialHighlightsVersion] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Refs
  const latestHighlightRef = useRef(null);
  const persistedSignatureRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isApplyingHistoryRef = useRef(false);
  const skipLoadFromUrlRef = useRef(false);

  // Custom hooks
  const promptOptimizer = usePromptOptimizer(selectedMode);
  const promptHistory = usePromptHistory(user);

  const currentMode = useMemo(
    () => modes.find((m) => m.id === selectedMode) || modes[0],
    [modes, selectedMode]
  );

  // Helper functions
  const applyInitialHighlightSnapshot = useCallback((snapshot, { bumpVersion = false, markPersisted = false } = {}) => {
    setInitialHighlights(snapshot ?? null);
    if (bumpVersion) {
      setInitialHighlightsVersion((prev) => prev + 1);
    }
    latestHighlightRef.current = snapshot ?? null;
    if (markPersisted) {
      persistedSignatureRef.current = snapshot?.signature ?? null;
    }
  }, []);

  const resetEditStacks = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const setDisplayedPromptSilently = useCallback((text) => {
    isApplyingHistoryRef.current = true;
    promptOptimizer.setDisplayedPrompt(text);
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [promptOptimizer]);

  // Create new prompt
  const handleCreateNew = useCallback(() => {
    skipLoadFromUrlRef.current = true;
    promptOptimizer.resetPrompt();
    setShowResults(false);
    setSuggestionsData(null);
    setConceptElements(null);
    setPromptContext(null);
    setCurrentPromptUuid(null);
    setCurrentPromptDocId(null);
    applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
    persistedSignatureRef.current = null;
    resetEditStacks();
    navigate('/', { replace: true });
  }, [promptOptimizer, navigate, applyInitialHighlightSnapshot, resetEditStacks]);

  // Load from history
  const loadFromHistory = useCallback((entry) => {
    

    skipLoadFromUrlRef.current = true;
    setCurrentPromptUuid(entry.uuid || null);
    setCurrentPromptDocId(entry.id || null);

    promptOptimizer.setInputPrompt(entry.input);
    promptOptimizer.setOptimizedPrompt(entry.output);
    setDisplayedPromptSilently(entry.output);
    setSelectedMode(entry.mode);
    setShowResults(true);

    const preloadedHighlight = entry.highlightCache
      ? {
          ...entry.highlightCache,
          signature: entry.highlightCache.signature ?? createHighlightSignature(entry.output ?? ''),
        }
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
      } catch (contextError) {
        console.error('Failed to restore prompt context from history entry:', contextError);
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
      });
    });
  }, [promptOptimizer, setDisplayedPromptSilently, applyInitialHighlightSnapshot, resetEditStacks, navigate]);

  // Context value
  const value = {
    // Mode
    modes,
    selectedMode,
    setSelectedMode,
    currentMode,

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
};
