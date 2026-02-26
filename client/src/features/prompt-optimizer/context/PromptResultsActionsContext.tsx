import React, { createContext, useContext, useMemo, type MutableRefObject, type ReactNode } from 'react';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { SpanLabelingResult } from '@/features/span-highlighting/hooks/types';
import type { CoherenceIssue } from '@/features/prompt-optimizer/components/coherence/useCoherenceAnnotations';
import type { CoherenceRecommendation } from '@/features/prompt-optimizer/types/coherence';
import type { SuggestionPayload, SuggestionItem } from '@/features/prompt-optimizer/PromptCanvas/types';
import type { SuggestionsData } from '@/features/prompt-optimizer/PromptCanvas/types';
import type { OptimizationOptions } from '@/features/prompt-optimizer/types';
import type { I2VContext } from '@/features/prompt-optimizer/types/i2v';
import type { User } from './types';
import { useAutoSave } from '@/features/prompt-optimizer/PromptOptimizerContainer/hooks/useAutoSave';

// ---------------------------------------------------------------------------
// Split 1: Actions — stable callback references that rarely change
// ---------------------------------------------------------------------------

interface PromptResultsActionsOnly {
  user: User | null;
  onDisplayedPromptChange: (text: string) => void;
  onReoptimize: (promptToOptimize?: string, options?: OptimizationOptions) => Promise<void>;
  onFetchSuggestions: (payload?: SuggestionPayload) => void;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onHighlightsPersist: (result: SpanLabelingResult) => void;
  onUndo: () => void;
  onRedo: () => void;
  stablePromptContext: PromptContext | null;
  onToggleCoherencePanelExpanded?: (() => void) | undefined;
  onDismissCoherenceIssue?: ((issueId: string) => void) | undefined;
  onDismissAllCoherenceIssues?: (() => void) | undefined;
  onApplyCoherenceFix?: ((
    issueId: string,
    recommendation: CoherenceRecommendation
  ) => void) | undefined;
  onScrollToCoherenceSpan?: ((spanId: string) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Split 2: Data — reactive values that change on user interaction
// ---------------------------------------------------------------------------

interface PromptResultsDataOnly {
  suggestionsData: SuggestionsData | null;
  coherenceAffectedSpanIds?: Set<string> | undefined;
  coherenceSpanIssueMap?: Map<string, 'conflict' | 'harmonization'> | undefined;
  coherenceIssues?: CoherenceIssue[] | undefined;
  isCoherenceChecking?: boolean | undefined;
  isCoherencePanelExpanded?: boolean | undefined;
  i2vContext?: I2VContext | null | undefined;
}

// ---------------------------------------------------------------------------
// Combined type — backward-compatible view
// ---------------------------------------------------------------------------

type PromptResultsActionsContextValue = PromptResultsActionsOnly & PromptResultsDataOnly;

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

interface PromptResultsActionsProviderProps
  extends Omit<PromptResultsActionsContextValue, 'onDisplayedPromptChange'> {
  children: ReactNode;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  displayedPrompt: string | null;
  isApplyingHistoryRef: MutableRefObject<boolean>;
  handleDisplayedPromptChange: (text: string) => void;
  updateEntryOutput: (uuid: string, docId: string | null, output: string) => Promise<void>;
  setOutputSaveState: (state: 'idle' | 'saving' | 'saved' | 'error') => void;
  setOutputLastSavedAt: (timestampMs: number | null) => void;
}

// ---------------------------------------------------------------------------
// Contexts (two granular + one combined for backward compat)
// ---------------------------------------------------------------------------

const ActionsOnlyContext = createContext<PromptResultsActionsOnly | null>(null);
const DataOnlyContext = createContext<PromptResultsDataOnly | null>(null);

// Legacy combined context — delegates to both split contexts
const PromptResultsActionsContext = createContext<PromptResultsActionsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PromptResultsActionsProvider({
  children,
  currentPromptUuid,
  currentPromptDocId,
  displayedPrompt,
  isApplyingHistoryRef,
  handleDisplayedPromptChange,
  updateEntryOutput,
  setOutputSaveState,
  setOutputLastSavedAt,
  user,
  onReoptimize,
  onFetchSuggestions,
  onSuggestionClick,
  onHighlightsPersist,
  onUndo,
  onRedo,
  stablePromptContext,
  suggestionsData,
  coherenceAffectedSpanIds,
  coherenceSpanIssueMap,
  coherenceIssues,
  isCoherenceChecking,
  isCoherencePanelExpanded,
  onToggleCoherencePanelExpanded,
  onDismissCoherenceIssue,
  onDismissAllCoherenceIssues,
  onApplyCoherenceFix,
  onScrollToCoherenceSpan,
  i2vContext,
}: PromptResultsActionsProviderProps): React.ReactElement {
  const { handleDisplayedPromptChangeWithAutosave } = useAutoSave({
    currentPromptUuid,
    currentPromptDocId,
    displayedPrompt,
    isApplyingHistoryRef,
    handleDisplayedPromptChange,
    updateEntryOutput,
    setOutputSaveState,
    setOutputLastSavedAt,
  });

  // Actions — should be stable across renders (all callbacks wrapped in useCallback by callers)
  const actionsValue = useMemo<PromptResultsActionsOnly>(() => ({
    user,
    onDisplayedPromptChange: handleDisplayedPromptChangeWithAutosave,
    onReoptimize,
    onFetchSuggestions,
    onSuggestionClick,
    onHighlightsPersist,
    onUndo,
    onRedo,
    stablePromptContext,
    onToggleCoherencePanelExpanded,
    onDismissCoherenceIssue,
    onDismissAllCoherenceIssues,
    onApplyCoherenceFix,
    onScrollToCoherenceSpan,
  }), [
    user,
    handleDisplayedPromptChangeWithAutosave,
    onReoptimize,
    onFetchSuggestions,
    onSuggestionClick,
    onHighlightsPersist,
    onUndo,
    onRedo,
    stablePromptContext,
    onToggleCoherencePanelExpanded,
    onDismissCoherenceIssue,
    onDismissAllCoherenceIssues,
    onApplyCoherenceFix,
    onScrollToCoherenceSpan,
  ]);

  // Data — changes when suggestions load, coherence results arrive, etc.
  const dataValue = useMemo<PromptResultsDataOnly>(() => ({
    suggestionsData,
    coherenceAffectedSpanIds,
    coherenceSpanIssueMap,
    coherenceIssues,
    isCoherenceChecking,
    isCoherencePanelExpanded,
    i2vContext,
  }), [
    suggestionsData,
    coherenceAffectedSpanIds,
    coherenceSpanIssueMap,
    coherenceIssues,
    isCoherenceChecking,
    isCoherencePanelExpanded,
    i2vContext,
  ]);

  // Combined value — for backward-compatible usePromptResultsActionsContext()
  const combinedValue = useMemo<PromptResultsActionsContextValue>(
    () => ({ ...actionsValue, ...dataValue }),
    [actionsValue, dataValue]
  );

  return (
    <ActionsOnlyContext.Provider value={actionsValue}>
      <DataOnlyContext.Provider value={dataValue}>
        <PromptResultsActionsContext.Provider value={combinedValue}>
          {children}
        </PromptResultsActionsContext.Provider>
      </DataOnlyContext.Provider>
    </ActionsOnlyContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Combined view — backward-compatible. Consumers re-render on ANY change.
 * Prefer the granular hooks below when you only need actions or data.
 */
export function usePromptResultsActionsContext(): PromptResultsActionsContextValue {
  const context = useContext(PromptResultsActionsContext);
  if (!context) {
    throw new Error('usePromptResultsActionsContext must be used within PromptResultsActionsProvider');
  }
  return context;
}

/**
 * Actions only — stable callback references. Re-renders only when a callback
 * identity changes (which should be rare if callers use useCallback properly).
 */
export function usePromptResultsActions(): PromptResultsActionsOnly {
  const context = useContext(ActionsOnlyContext);
  if (!context) {
    throw new Error('usePromptResultsActions must be used within PromptResultsActionsProvider');
  }
  return context;
}

/**
 * Data only — reactive values (suggestions, coherence state, i2v context).
 * Re-renders only when data changes, not when callbacks are swapped.
 */
export function usePromptResultsData(): PromptResultsDataOnly {
  const context = useContext(DataOnlyContext);
  if (!context) {
    throw new Error('usePromptResultsData must be used within PromptResultsActionsProvider');
  }
  return context;
}
