import { useCallback } from 'react';
import { applySuggestionToPrompt } from '../../utils/applySuggestion.js';
import { fetchEnhancementSuggestions as fetchSuggestionsAPI } from '../../api/enhancementSuggestionsApi';

/**
 * Custom hook for enhancement suggestions
 * Handles fetching and applying suggestions for highlighted text
 */
export function useEnhancementSuggestions({
  promptOptimizer,
  selectedMode,
  suggestionsData,
  setSuggestionsData,
  setDisplayedPromptSilently,
  stablePromptContext,
  toast,
}) {
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
        currentPrompt: fullPrompt,
        selectedText,
        suggestionText,
        range,
        offsets,
        metadata,
      });

      // Update displayed prompt
      if (result.updatedPrompt) {
        setDisplayedPromptSilently(result.updatedPrompt);
        toast.success('Suggestion applied');
      }

      // Close suggestions panel
      setSuggestionsData(null);
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error('Failed to apply suggestion');
    }
  }, [suggestionsData, setDisplayedPromptSilently, setSuggestionsData, toast]);

  /**
   * Fetch enhancement suggestions for highlighted text
   */
  const fetchEnhancementSuggestions = useCallback(async (payload = {}) => {
    const {
      highlightedText,
      originalText,
      displayedPrompt: payloadPrompt,
      range,
      offsets,
      metadata: rawMetadata = null,
      trigger = 'highlight',
    } = payload;

    const trimmedHighlight = (highlightedText || '').trim();
    const rawPrompt = payloadPrompt ?? promptOptimizer.displayedPrompt ?? '';
    const normalizedPrompt = rawPrompt.normalize('NFC');
    const metadata = rawMetadata
      ? {
          ...rawMetadata,
          span: rawMetadata.span ? { ...rawMetadata.span } : null,
        }
      : null;

    // Early returns for invalid cases
    if (selectedMode !== 'video' || !trimmedHighlight) {
      return;
    }

    if (suggestionsData?.selectedText === trimmedHighlight && suggestionsData?.show) {
      return;
    }

    // Show loading state immediately
    setSuggestionsData({
      show: true,
      selectedText: trimmedHighlight,
      originalText: originalText || trimmedHighlight,
      suggestions: [],
      isLoading: true,
      isPlaceholder: false,
      fullPrompt: normalizedPrompt,
      range,
      offsets,
      metadata,
      setSuggestions: (newSuggestions, newIsPlaceholder) => {
        setSuggestionsData((prev) => ({
          ...prev,
          suggestions: newSuggestions,
          isPlaceholder:
            newIsPlaceholder !== undefined
              ? newIsPlaceholder
              : prev.isPlaceholder,
        }));
      },
      onSuggestionClick: handleSuggestionClick,
      onClose: () => setSuggestionsData(null),
    });

    try {
      // Delegate to API layer (VideoConceptBuilder pattern)
      const { suggestions, isPlaceholder } = await fetchSuggestionsAPI({
        highlightedText: trimmedHighlight,
        normalizedPrompt,
        inputPrompt: promptOptimizer.inputPrompt,
        brainstormContext: stablePromptContext,
        metadata,
      });

      // Update with results
      setSuggestionsData(prev => ({
        ...prev,
        suggestions,
        isLoading: false,
        isPlaceholder,
      }));
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Failed to load suggestions');

      setSuggestionsData((prev) => ({
        ...prev,
        isLoading: false,
        suggestions: [{ text: 'Failed to load suggestions. Please try again.' }],
      }));
    }
  }, [
    promptOptimizer,
    selectedMode,
    suggestionsData,
    setSuggestionsData,
    stablePromptContext,
    toast,
    handleSuggestionClick,
  ]);

  return {
    fetchEnhancementSuggestions,
    handleSuggestionClick,
  };
}

