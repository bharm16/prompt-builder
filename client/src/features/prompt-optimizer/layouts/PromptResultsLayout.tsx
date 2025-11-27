import React from 'react';
import { PromptSidebar } from '../components/PromptSidebar';
import { PromptResultsSection } from '../components/PromptResultsSection';
import SuggestionsPanel from '@components/SuggestionsPanel';
import type { User } from '../context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
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
  onFetchSuggestions: (data: unknown) => void;
  onSuggestionClick: (suggestion: unknown) => void;
  onHighlightsPersist: (result: unknown) => void;
  onUndo: () => void;
  onRedo: () => void;
  stablePromptContext: PromptContext | null;
  suggestionsData: unknown | null;
  displayedPrompt?: string;
}

export const PromptResultsLayout = ({
  user,
  onDisplayedPromptChange,
  onFetchSuggestions,
  onSuggestionClick,
  onHighlightsPersist,
  onUndo,
  onRedo,
  stablePromptContext,
  suggestionsData,
  displayedPrompt,
}: PromptResultsLayoutProps): React.ReactElement => {
  // Check if suggestions should be visible based on data presence
  const isSuggestionsOpen = suggestionsData && (suggestionsData as Record<string, unknown>).show !== false;

  return (
    <div className="prompt-results-layout">
      {/* History Sidebar */}
      <PromptSidebar user={user} />

      {/* Main Content - Canvas */}
      <main className="prompt-results-layout__main" id="main-content">
        <PromptResultsSection
          onDisplayedPromptChange={onDisplayedPromptChange}
          onFetchSuggestions={onFetchSuggestions}
          onSuggestionClick={onSuggestionClick}
          onHighlightsPersist={onHighlightsPersist}
          onUndo={onUndo}
          onRedo={onRedo}
          stablePromptContext={stablePromptContext}
        />
      </main>

      {/* The overlay panel.
         We use data-open to trigger the CSS transform.
      */}
      <aside 
        className="prompt-results-layout__suggestions"
        data-open={isSuggestionsOpen}
      >
        <SuggestionsPanel
          suggestionsData={
            suggestionsData
              ? {
                  ...(suggestionsData as Record<string, unknown>),
                  onSuggestionClick: onSuggestionClick,
                  currentPrompt: displayedPrompt,
                }
              : { show: false, currentPrompt: displayedPrompt }
          }
        />
      </aside>
    </div>
  );
};

