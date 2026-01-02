/**
 * Types for PromptStateContext
 */

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { PromptHistoryEntry } from '@hooks/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { HighlightSnapshot as CanvasHighlightSnapshot, SuggestionsData, SpansData } from '../PromptCanvas/types';
import type { OptimizationOptions } from '../types';

export type { PromptHistoryEntry };
export type HighlightSnapshot = CanvasHighlightSnapshot;

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

export interface PromptOptimizer {
  inputPrompt: string;
  setInputPrompt: (prompt: string) => void;
  isProcessing: boolean;
  optimizedPrompt: string;
  setOptimizedPrompt: (prompt: string) => void;
  displayedPrompt: string;
  setDisplayedPrompt: (prompt: string) => void;
  previewPrompt: string | null;
  setPreviewPrompt: (prompt: string | null) => void;
  previewAspectRatio: string | null;
  setPreviewAspectRatio: (ratio: string | null) => void;
  qualityScore: number | null;
  skipAnimation: boolean;
  setSkipAnimation: (skip: boolean) => void;
  improvementContext: unknown | null;
  setImprovementContext: (context: unknown | null) => void;
  draftPrompt: string;
  isDraftReady: boolean;
  isRefining: boolean;
  draftSpans: SpansData | null;
  refinedSpans: SpansData | null;
  optimize: (
    prompt?: string,
    context?: unknown | null,
    brainstormContext?: unknown | null,
    targetModel?: string,
    options?: OptimizationOptions
  ) => Promise<{ optimized: string; score: number | null } | null>;
  resetPrompt: () => void;
  [key: string]: unknown;
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
    targetModel?: string | null,
    brainstormContext?: unknown,
    highlightCache?: unknown
  ) => Promise<{ uuid: string; id: string } | null>;
  clearHistory: () => Promise<void>;
  deleteFromHistory: (entryId: string) => Promise<void>;
  loadHistoryFromFirestore: (userId: string) => Promise<void>;
  updateEntryHighlight: (uuid: string, highlightCache: unknown) => void;
  updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  [key: string]: unknown;
}

export interface StateSnapshot {
  text: string;
  highlight: HighlightSnapshot | null;
  timestamp: number;
  version: number;
}

export interface PromptStateContextValue {
  // Mode
  modes: Mode[];
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  currentMode: Mode;
  selectedModel: string; // New: selected video model
  setSelectedModel: (model: string) => void; // New: setter for model

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
  suggestionsData: SuggestionsData | null;
  setSuggestionsData: Dispatch<SetStateAction<SuggestionsData | null>>;
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
  undoStackRef: React.MutableRefObject<StateSnapshot[]>;
  redoStackRef: React.MutableRefObject<StateSnapshot[]>;
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
