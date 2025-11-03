/**
 * Enhancement Suggestions API
 *
 * Centralized API calls for fetching enhancement suggestions.
 * Following VideoConceptBuilder pattern: api/videoConceptApi.js
 *
 * File size: ~80 lines (within 150-line limit for API layer)
 */

import { API_CONFIG } from '../../../config/api.config';

/**
 * Fetch enhancement suggestions for highlighted text
 *
 * @param {Object} params - Request parameters
 * @param {string} params.highlightedText - The highlighted text
 * @param {string} params.normalizedPrompt - Full prompt context (normalized)
 * @param {string} params.inputPrompt - Original user input
 * @param {Object|null} params.brainstormContext - Brainstorm context
 * @param {Object|null} params.metadata - Highlight metadata (category, confidence, etc.)
 * @returns {Promise<{suggestions: Array, isPlaceholder: boolean}>}
 * @throws {Error} If API call fails
 */
export async function fetchEnhancementSuggestions({
  highlightedText,
  normalizedPrompt,
  inputPrompt,
  brainstormContext = null,
  metadata = null,
}) {
  // Extract context around the highlighted text
  const highlightIndex = normalizedPrompt.indexOf(highlightedText);

  const contextBefore = normalizedPrompt
    .substring(Math.max(0, highlightIndex - 300), highlightIndex)
    .trim();

  const contextAfter = normalizedPrompt
    .substring(
      highlightIndex + highlightedText.length,
      Math.min(
        normalizedPrompt.length,
        highlightIndex + highlightedText.length + 300
      )
    )
    .trim();

  // Make API call
  const response = await fetch('/api/get-enhancement-suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify({
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt: normalizedPrompt,
      originalUserPrompt: inputPrompt,
      brainstormContext: brainstormContext?.toJSON
        ? brainstormContext.toJSON()
        : brainstormContext,
      highlightedCategory: metadata?.category || null,
      highlightedCategoryConfidence: metadata?.confidence || null,
      highlightedPhrase: metadata?.quote || highlightedText,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.status}`);
  }

  const data = await response.json();

  return {
    suggestions: data.suggestions || [],
    isPlaceholder: data.isPlaceholder || false,
  };
}

/**
 * Enhancement Suggestions API object (for namespace compatibility)
 */
export const enhancementSuggestionsApi = {
  fetchEnhancementSuggestions,
};
