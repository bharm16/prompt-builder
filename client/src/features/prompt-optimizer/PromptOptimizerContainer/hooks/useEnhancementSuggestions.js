/**
 * Enhancement Suggestions Hook (Orchestrator)
 * 
 * Main hook for managing enhancement suggestions.
 * Orchestrates suggestion fetching and application.
 * 
 * Architecture: Orchestrator pattern
 * Pattern: Delegates to specialized hooks
 * Reference: VideoConceptBuilder hook composition pattern
 * 
 * REFACTORED: Reduced from 289 lines to ~35 lines
 * - Validation logic → utils/spanValidation.js
 * - Span processing → utils/spanUtils.js
 * - Apply logic → hooks/useSuggestionApply.js
 * - Fetch logic → hooks/useSuggestionFetch.js
 */

import { useSuggestionApply } from './useSuggestionApply.js';
import { useSuggestionFetch } from './useSuggestionFetch.js';

/**
 * Custom hook for enhancement suggestions
 * Handles fetching and applying suggestions for highlighted text
 * 
 * @param {Object} params - Hook parameters
 * @param {Object} params.promptOptimizer - Prompt optimizer state
 * @param {string} params.selectedMode - Current mode (video/image/etc)
 * @param {Object} params.suggestionsData - Current suggestions state
 * @param {Function} params.setSuggestionsData - Update suggestions state
 * @param {Function} params.setDisplayedPromptSilently - Update prompt silently
 * @param {Object} params.stablePromptContext - Stable brainstorm context
 * @param {Object} params.toast - Toast notification instance
 * @returns {Object} { fetchEnhancementSuggestions, handleSuggestionClick }
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
  // Handle applying suggestions
  const { handleSuggestionClick } = useSuggestionApply({
    suggestionsData,
    setDisplayedPromptSilently,
    setSuggestionsData,
    toast,
  });

  // Handle fetching suggestions
  const { fetchEnhancementSuggestions } = useSuggestionFetch({
    promptOptimizer,
    selectedMode,
    suggestionsData,
    setSuggestionsData,
    stablePromptContext,
    toast,
    handleSuggestionClick, // Pass down from apply hook
  });

  return {
    fetchEnhancementSuggestions,
    handleSuggestionClick,
  };
}

