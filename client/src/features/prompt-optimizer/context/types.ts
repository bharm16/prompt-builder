/**
 * Types for PromptStateContext
 */

import type { ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { PromptHistoryEntry } from '../../../hooks/types';
import type { PromptContext } from '../../../utils/PromptContext/PromptContext';

export interface User {
  uid: string;
  [key: string]: unknown;
}

export interface Mode {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
}

export interface HighlightSnapshot {
  signature: string;
  [key: string]: unknown;
}

export interface PromptOptimizer {
  inputPrompt: string;
  setInputPrompt: (prompt: string) => void;
  isProcessing: boolean;
  optimizedPrompt: string;
  setOptimizedPrompt: (prompt: string) => void;
  displayedPrompt: string;
  setDisplayedPrompt: (prompt: string) => void;
  qualityScore: number | null;
  skipAnimation: boolean;
  setSkipAnimation: (skip: boolean) => void;
  improvementContext: unknown | null;
  setImprovementContext: (context: unknown | null) => void;
  draftPrompt: string;
  isDraftReady: boolean;
  isRefining: boolean;
  draftSpans: unknown | null;
  refinedSpans: unknown | null;
  optimize: (
    prompt?: string,
    context?: unknown | null,
    brainstormContext?: unknown | null
  ) => Promise<{ optimized: string; score: number | null } | null>;
  resetPrompt: () => void;
}

export interface PromptHistory {
  history: PromptHistoryEntry[];
  filteredHistory: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  saveToHistory: (
    input: string,
    output: string,
    score: number | null,
    selectedMode: string,
    brainstormContext?: unknown,
    highlightCache?: unknown
  ) => Promise<{ uuid: string; id: string } | null>;
  clearHistory: () => Promise<void>;
  deleteFromHistory: (entryId: string) => Promise<void>;
  loadHistoryFromFirestore: (userId: string) => Promise<void>;
  updateEntryHighlight: (uuid: string, highlightCache: unknown) => void;
}

export interface PromptStateContextValue {
  // Mode
  modes: Mode[];
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  currentMode: Mode;

  // UI State
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
  showImprover: boolean;
  setShowImprover: (show: boolean) => void;
  showBrainstorm: boolean;
  setShowBrainstorm: (show: boolean) => void;
  currentAIIndex: number;
  setCurrentAIIndex: (index: number) => void;

  // Prompt State
  suggestionsData: unknown | null;
  setSuggestionsData: (data: unknown | null) => void;
  conceptElements: unknown | null;
  setConceptElements: (elements: unknown | null) => void;
  promptContext: PromptContext | null;
  setPromptContext: (context: PromptContext | null) => void;
  currentPromptUuid: string | null;
  setCurrentPromptUuid: (uuid: string | null) => void;
  currentPromptDocId: string | null;
  setCurrentPromptDocId: (docId: string | null) => void;

  // Highlights
  initialHighlights: HighlightSnapshot | null;
  setInitialHighlights: (highlights: HighlightSnapshot | null) => void;
  initialHighlightsVersion: number;
  setInitialHighlightsVersion: (version: number) => void;
  canUndo: boolean;
  setCanUndo: (canUndo: boolean) => void;
  canRedo: boolean;
  setCanRedo: (canRedo: boolean) => void;

  // Refs
  latestHighlightRef: React.MutableRefObject<HighlightSnapshot | null>;
  persistedSignatureRef: React.MutableRefObject<string | null>;
  undoStackRef: React.MutableRefObject<unknown[]>;
  redoStackRef: React.MutableRefObject<unknown[]>;
  isApplyingHistoryRef: React.MutableRefObject<boolean>;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;

  // Hooks
  promptOptimizer: PromptOptimizer;
  promptHistory: PromptHistory;

  // Helper functions
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options?: { bumpVersion?: boolean; markPersisted?: boolean }
  ) => void;
  resetEditStacks: () => void;
  setDisplayedPromptSilently: (text: string) => void;
  handleCreateNew: () => void;
  loadFromHistory: (entry: PromptHistoryEntry) => void;

  // Navigation
  navigate: NavigateFunction;
  uuid: string | undefined;
}

export interface PromptStateProviderProps {
  children: ReactNode;
  user: User | null;
}

