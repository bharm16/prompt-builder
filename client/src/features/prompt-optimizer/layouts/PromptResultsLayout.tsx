import React from 'react';
import { PromptResultsSection } from '../components/PromptResultsSection';
import type { User } from '../context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { SuggestionPayload, SuggestionsData, SuggestionItem } from '../PromptCanvas/types';
import type { OptimizationOptions } from '../types';

/**
 * PromptResultsLayout - Results/Canvas View Layout
 * 
 * Main content layout for the results/canvas view (PromptCanvas via PromptResultsSection).
 *
 * App shell (history sidebar + top bar) lives in PromptOptimizerWorkspace.
 */
interface PromptResultsLayoutProps {
  user: User | null;
  onDisplayedPromptChange: (text: string) => void;
  onReoptimize: (promptToOptimize?: string, options?: OptimizationOptions) => Promise<void>;
  onFetchSuggestions: (payload?: SuggestionPayload) => void;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onHighlightsPersist: (result: {
    spans: Array<{ start: number; end: number; category: string; confidence: number }>;
    meta: Record<string, unknown> | null;
    signature: string;
    cacheId?: string | null;
    source?: string;
    [key: string]: unknown;
  }) => void;
  onUndo: () => void;
  onRedo: () => void;
  stablePromptContext: PromptContext | null;
  suggestionsData: SuggestionsData | null;
  displayedPrompt?: string;
}

export const PromptResultsLayout = ({
  user,
  onDisplayedPromptChange,
  onReoptimize,
  onFetchSuggestions,
  onSuggestionClick,
  onHighlightsPersist,
  onUndo,
  onRedo,
  stablePromptContext,
}: PromptResultsLayoutProps): React.ReactElement => {
  return (
    <main
      id="main-content"
      className="relative flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden bg-app transition-colors duration-300"
    >
      <PromptResultsSection
        user={user}
        onDisplayedPromptChange={onDisplayedPromptChange}
        onReoptimize={onReoptimize}
        onFetchSuggestions={onFetchSuggestions}
        onSuggestionClick={onSuggestionClick}
        onHighlightsPersist={onHighlightsPersist}
        onUndo={onUndo}
        onRedo={onRedo}
        stablePromptContext={stablePromptContext}
      />
    </main>
  );
};
