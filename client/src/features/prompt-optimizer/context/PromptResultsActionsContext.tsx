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

interface PromptResultsActionsContextValue {
  user: User | null;
  onDisplayedPromptChange: (text: string) => void;
  onReoptimize: (promptToOptimize?: string, options?: OptimizationOptions) => Promise<void>;
  onFetchSuggestions: (payload?: SuggestionPayload) => void;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onHighlightsPersist: (result: SpanLabelingResult) => void;
  onUndo: () => void;
  onRedo: () => void;
  stablePromptContext: PromptContext | null;
  suggestionsData: SuggestionsData | null;
  coherenceAffectedSpanIds?: Set<string> | undefined;
  coherenceSpanIssueMap?: Map<string, 'conflict' | 'harmonization'> | undefined;
  coherenceIssues?: CoherenceIssue[] | undefined;
  isCoherenceChecking?: boolean | undefined;
  isCoherencePanelExpanded?: boolean | undefined;
  onToggleCoherencePanelExpanded?: (() => void) | undefined;
  onDismissCoherenceIssue?: ((issueId: string) => void) | undefined;
  onDismissAllCoherenceIssues?: (() => void) | undefined;
  onApplyCoherenceFix?: ((
    issueId: string,
    recommendation: CoherenceRecommendation
  ) => void) | undefined;
  onScrollToCoherenceSpan?: ((spanId: string) => void) | undefined;
  i2vContext?: I2VContext | null | undefined;
}

interface PromptResultsActionsProviderProps
  extends Omit<PromptResultsActionsContextValue, 'onDisplayedPromptChange'> {
  children: ReactNode;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  displayedPrompt: string | null;
  isApplyingHistoryRef: MutableRefObject<boolean>;
  handleDisplayedPromptChange: (text: string) => void;
  updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  setOutputSaveState: (state: 'idle' | 'saving' | 'saved' | 'error') => void;
  setOutputLastSavedAt: (timestampMs: number | null) => void;
}

const PromptResultsActionsContext = createContext<PromptResultsActionsContextValue | null>(null);

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

  const value = useMemo<PromptResultsActionsContextValue>(() => ({
    user,
    onDisplayedPromptChange: handleDisplayedPromptChangeWithAutosave,
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
  ]);

  return (
    <PromptResultsActionsContext.Provider value={value}>{children}</PromptResultsActionsContext.Provider>
  );
}

export function usePromptResultsActionsContext(): PromptResultsActionsContextValue {
  const context = useContext(PromptResultsActionsContext);
  if (!context) {
    throw new Error('usePromptResultsActionsContext must be used within PromptResultsActionsProvider');
  }
  return context;
}
