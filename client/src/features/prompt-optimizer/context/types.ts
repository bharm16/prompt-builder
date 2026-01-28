/**
 * Types for PromptStateContext
 */

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { IconProps } from '@promptstudio/system/components/ui';
import type { PromptHistoryEntry, PromptVersionEdit, PromptVersionEntry } from '@hooks/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { CapabilityValues } from '@shared/capabilities';
import type { UpdatePromptOptions } from '@repositories/promptRepositoryTypes';
import type { HighlightSnapshot as CanvasHighlightSnapshot, SuggestionsData, SpansData } from '../PromptCanvas/types';
import type { LockedSpan, OptimizationOptions } from '../types';

export type { PromptHistoryEntry };
export type HighlightSnapshot = CanvasHighlightSnapshot;

export interface User {
  uid: string;
  [key: string]: unknown;
}

export interface Mode {
  id: string;
  name: string;
  icon: IconProps['icon'];
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
  genericOptimizedPrompt: string | null;
  setGenericOptimizedPrompt?: (prompt: string | null) => void;
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
  lockedSpans: LockedSpan[];
  optimize: (
    prompt?: string,
    context?: unknown | null,
    brainstormContext?: unknown | null,
    targetModel?: string,
    options?: OptimizationOptions
  ) => Promise<{ optimized: string; score: number | null } | null>;
  compile: (
    prompt: string,
    targetModel?: string,
    context?: unknown | null
  ) => Promise<{ optimized: string; score: number | null } | null>;
  resetPrompt: () => void;
  setLockedSpans: (spans: LockedSpan[]) => void;
  addLockedSpan: (span: LockedSpan) => void;
  removeLockedSpan: (spanId: string) => void;
  clearLockedSpans: () => void;
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
    generationParams?: Record<string, unknown> | null,
    brainstormContext?: unknown,
    highlightCache?: unknown,
    existingUuid?: string | null,
    title?: string | null
  ) => Promise<{ uuid: string; id: string } | null>;
  createDraft: (params: {
    mode: string;
    targetModel: string | null;
    generationParams: Record<string, unknown> | null;
    uuid?: string;
  }) => { uuid: string; id: string };
  updateEntryLocal: (uuid: string, updates: Partial<PromptHistoryEntry>) => void;
  clearHistory: () => Promise<void>;
  deleteFromHistory: (entryId: string) => Promise<void>;
  loadHistoryFromFirestore: (userId: string) => Promise<void>;
  updateEntryHighlight: (uuid: string, highlightCache: unknown) => void;
  updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  updateEntryPersisted: (uuid: string, docId: string | null, updates: UpdatePromptOptions) => void;
  updateEntryVersions: (uuid: string, docId: string | null, versions: PromptVersionEntry[]) => void;
  [key: string]: unknown;
}

export interface StateSnapshot {
  text: string;
  highlight: HighlightSnapshot | null;
  timestamp: number;
  version: number;
}

export interface PromptConfigState {
  // Mode
  modes: Mode[];
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  currentMode: Mode;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  generationParams: CapabilityValues;
  setGenerationParams: (params: CapabilityValues) => void;
}

export interface PromptUIState {
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

  // Output persistence (autosave)
  outputSaveState: 'idle' | 'saving' | 'saved' | 'error';
  setOutputSaveState: (state: 'idle' | 'saving' | 'saved' | 'error') => void;
  outputLastSavedAt: number | null;
  setOutputLastSavedAt: (timestampMs: number | null) => void;
}

export interface PromptSessionState {
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
  activeVersionId: string | null;
  setActiveVersionId: (id: string | null) => void;
}

export interface PromptHighlightState {
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
  versionEditCountRef: React.MutableRefObject<number>;
  versionEditsRef: React.MutableRefObject<PromptVersionEdit[]>;
  undoStackRef: React.MutableRefObject<StateSnapshot[]>;
  redoStackRef: React.MutableRefObject<StateSnapshot[]>;
  isApplyingHistoryRef: React.MutableRefObject<boolean>;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;
}

export interface PromptServicesState {
  // Hooks
  promptOptimizer: PromptOptimizer;
  promptHistory: PromptHistory;
}

export interface PromptActionsState {
  // Helper functions
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options?: { bumpVersion?: boolean; markPersisted?: boolean }
  ) => void;
  resetEditStacks: () => void;
  registerPromptEdit: (payload: { previousText: string; nextText: string; source?: 'manual' | 'suggestion' | 'unknown' }) => void;
  resetVersionEdits: () => void;
  setDisplayedPromptSilently: (text: string) => void;
  handleCreateNew: () => void;
  loadFromHistory: (entry: PromptHistoryEntry) => void;
}

export interface PromptNavigationState {
  // Navigation
  navigate: NavigateFunction;
  uuid: string | undefined;
}

export type PromptStateContextValue =
  PromptConfigState &
  PromptUIState &
  PromptSessionState &
  PromptHighlightState &
  PromptServicesState &
  PromptActionsState &
  PromptNavigationState;

export interface PromptStateProviderProps {
  children: ReactNode;
  user: User | null;
}
