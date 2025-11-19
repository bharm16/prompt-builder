/**
 * Suggestion Fetch Hook
 * 
 * Handles fetching enhancement suggestions for highlighted text.
 * Extracted from useEnhancementSuggestions.js.
 * 
 * Architecture: Custom React hook
 * Pattern: Single responsibility - suggestion fetching
 * Reference: VideoConceptBuilder hooks pattern
 * Line count: ~150 lines (within <150 limit for hooks)
 */

import { useCallback } from 'react';
import { fetchEnhancementSuggestions as fetchSuggestionsAPI } from '../../api/enhancementSuggestionsApi';
import { prepareSpanContext } from '../../utils/spanUtils.js';
import { useEditHistory } from '../../hooks/useEditHistory';

/**
 * Hook for fetching enhancement suggestions
 * @param {Object} params - Hook parameters
 * @param {Object} params.promptOptimizer - Prompt optimizer state
 * @param {string} params.selectedMode - Current mode (video/image/etc)
 * @param {Object} params.suggestionsData - Current suggestions state
 * @param {Function} params.setSuggestionsData - Update suggestions state
 * @param {Object} params.stablePromptContext - Stable brainstorm context
 * @param {Object} params.toast - Toast notification instance
 * @param {Function} params.handleSuggestionClick - Click handler from useSuggestionApply
 * @returns {Object} { fetchEnhancementSuggestions }
 */
export function useSuggestionFetch({
  promptOptimizer,
  selectedMode,
  suggestionsData,
  setSuggestionsData,
  stablePromptContext,
  toast,
  handleSuggestionClick,
}) {
  const { getEditSummary } = useEditHistory();

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
      allLabeledSpans = [],
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

    // Avoid duplicate requests
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
      // Prepare span context (sanitized and validated)
      const { simplifiedSpans, nearbySpans } = prepareSpanContext(
        metadata,
        allLabeledSpans
      );

      // Get edit history for context
      const editHistory = getEditSummary(10);

      // Delegate to API layer (VideoConceptBuilder pattern)
      const { suggestions, isPlaceholder } = await fetchSuggestionsAPI({
        highlightedText: trimmedHighlight,
        normalizedPrompt,
        inputPrompt: promptOptimizer.inputPrompt,
        brainstormContext: stablePromptContext,
        metadata,
        allLabeledSpans: simplifiedSpans,
        nearbySpans: nearbySpans,
        editHistory,
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
    suggestionsData?.selectedText,
    suggestionsData?.show,
    setSuggestionsData,
    stablePromptContext,
    toast,
    handleSuggestionClick,
    getEditSummary,
  ]);

  return {
    fetchEnhancementSuggestions,
  };
}

