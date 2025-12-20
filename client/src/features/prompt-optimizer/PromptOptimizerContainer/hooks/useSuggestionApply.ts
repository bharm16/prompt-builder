/**
 * Suggestion Apply Hook
 *
 * Handles applying selected suggestions to the prompt.
 * Extracted from useEnhancementSuggestions.js.
 *
 * Architecture: Custom React hook
 * Pattern: Single responsibility - suggestion application
 * Reference: VideoConceptBuilder hooks pattern
 * Line count: ~80 lines (within <150 limit for hooks)
 */

import { useCallback } from 'react';
import { applySuggestionToPrompt } from '../../utils/applySuggestion.ts';
import { useEditHistory } from '../../hooks/useEditHistory';
import type { Toast } from '@hooks/types';
import type { SuggestionItem, SuggestionsData } from '../../PromptCanvas/types';

interface UseSuggestionApplyParams {
  suggestionsData: SuggestionsData | null;
  handleDisplayedPromptChange: (prompt: string) => void;
  setSuggestionsData: (data: SuggestionsData | null) => void;
  toast: Toast;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  promptHistory: {
    updateEntryOutput: (uuid: string, docId: string | null, output: string) => void;
  };
}

/**
 * Hook for applying suggestions to prompt
 */
export function useSuggestionApply({
  suggestionsData,
  handleDisplayedPromptChange,
  setSuggestionsData,
  toast,
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
}: UseSuggestionApplyParams): {
  handleSuggestionClick: (suggestion: SuggestionItem | string) => Promise<void>;
} {
  // Initialize edit history tracking
  const { addEdit } = useEditHistory();

  /**
   * Handle suggestion click - apply suggestion to prompt
   */
  const handleSuggestionClick = useCallback(
    async (suggestion: SuggestionItem | string): Promise<void> => {
      const suggestionText =
        typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

      if (!suggestionText || !suggestionsData) return;

      const { selectedText, fullPrompt, offsets, metadata } = suggestionsData;

      try {
        // Apply the suggestion (delegates to utility)
        const result = await applySuggestionToPrompt({
          prompt: fullPrompt,
          suggestionText,
          highlight: selectedText,
          spanMeta: (metadata?.span as Record<string, unknown>) || {},
          ...(metadata ? { metadata: metadata as Record<string, unknown> } : {}),
          ...(offsets ? { offsets: offsets as { start?: number; end?: number } } : {}),
        });

        // Update displayed prompt
        if (result.updatedPrompt) {
          handleDisplayedPromptChange(result.updatedPrompt);
          toast.success('Suggestion applied');

          // Track this edit in history
          addEdit({
            original: selectedText,
            replacement: suggestionText,
            category:
              metadata?.category || metadata?.span?.category || null,
            position: offsets?.start || null,
            confidence:
              metadata?.confidence || metadata?.span?.confidence || null,
          });

          // Persist the updated prompt to database/storage
          if (currentPromptUuid && result.updatedPrompt) {
            try {
              promptHistory.updateEntryOutput(
                currentPromptUuid,
                currentPromptDocId,
                result.updatedPrompt
              );
            } catch (error) {
              // Don't block UI if save fails - just log warning
              console.warn('Failed to persist suggestion update:', error);
            }
          }
        } else {
          toast.error('Could not locate text to replace');
        }

        // Close suggestions panel
        setSuggestionsData(null);
      } catch (error) {
        console.error('Error applying suggestion:', error);
        toast.error('Failed to apply suggestion');
      }
    },
    [suggestionsData, handleDisplayedPromptChange, setSuggestionsData, toast, addEdit, currentPromptUuid, currentPromptDocId, promptHistory]
  );

  return {
    handleSuggestionClick,
  };
}
