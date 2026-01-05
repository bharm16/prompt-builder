import React from 'react';
import { PromptResultsSection } from '../components/PromptResultsSection';
import type { User } from '../context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { SuggestionPayload, SuggestionsData, SuggestionItem } from '../PromptCanvas/types';
import type { OptimizationOptions } from '../types';
import './PromptResultsLayout.css';

/**
 * PromptResultsLayout - Results/Canvas View Layout
 * 
 * Self-contained layout for the results/canvas view with:
 * - History Sidebar (left column)
 * - PromptCanvas in center (via PromptResultsSection)
 * - Suggestions Panel (right column)
 * 
 * Completely isolated from PromptInputLayout to prevent CSS/state conflicts
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
    <div className="prompt-results-layout">
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
    </div>
  );
};
