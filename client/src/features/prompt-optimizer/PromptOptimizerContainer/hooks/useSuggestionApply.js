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
import { applySuggestionToPrompt } from '../../utils/applySuggestion.js';
import { useEditHistory } from '../../hooks/useEditHistory.js';

/**
 * Hook for applying suggestions to prompt
 * @param {Object} params - Hook parameters
 * @param {Object} params.suggestionsData - Current suggestions state
 * @param {Function} params.handleDisplayedPromptChange - Update prompt with undo/redo support
 * @param {Function} params.setSuggestionsData - Update suggestions state
 * @param {Object} params.toast - Toast notification instance
 * @returns {Object} { handleSuggestionClick }
 */
export function useSuggestionApply({
  suggestionsData,
  handleDisplayedPromptChange,
  setSuggestionsData,
  toast,
}) {
  // Initialize edit history tracking
  const { addEdit } = useEditHistory();

  /**
   * Handle suggestion click - apply suggestion to prompt
   */
  const handleSuggestionClick = useCallback(async (suggestion) => {
    const suggestionText =
      typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

    if (!suggestionText || !suggestionsData) return;

    const {
      selectedText,
      fullPrompt,
      range,
      offsets,
      metadata,
    } = suggestionsData;

    try {
      // Apply the suggestion (delegates to utility)
      const result = await applySuggestionToPrompt({
        prompt: fullPrompt,
        suggestionText,
        highlight: selectedText,
        spanMeta: metadata?.span || {},
        metadata,
        offsets,
      });

      // Update displayed prompt
      if (result.updatedPrompt) {
        handleDisplayedPromptChange(result.updatedPrompt);
        toast.success('Suggestion applied');

        // Track this edit in history
        addEdit({
          original: selectedText,
          replacement: suggestionText,
          category: metadata?.category || metadata?.span?.category || null,
          position: offsets?.start || null,
          confidence: metadata?.confidence || metadata?.span?.confidence || null,
        });
      } else {
        toast.error('Could not locate text to replace');
      }

      // Close suggestions panel
      setSuggestionsData(null);
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error('Failed to apply suggestion');
    }
  }, [suggestionsData, handleDisplayedPromptChange, setSuggestionsData, toast, addEdit]);

  return {
    handleSuggestionClick,
  };
}

