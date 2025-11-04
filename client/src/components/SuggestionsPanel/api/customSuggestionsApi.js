/**
 * Custom Suggestions API
 *
 * Centralized API calls for fetching custom suggestions.
 * Following VideoConceptBuilder pattern: api/videoConceptApi.js
 */

import { API_CONFIG } from '../../../config/api.config';
import { API_ENDPOINTS } from '../config/panelConfig';

/**
 * Fetch custom suggestions from the backend
 *
 * @param {Object} params - Request parameters
 * @param {string} params.highlightedText - The selected text
 * @param {string} params.customRequest - User's custom request
 * @param {string} params.fullPrompt - Full prompt context
 * @returns {Promise<Array>} Array of suggestions
 * @throws {Error} If API call fails
 */
export async function fetchCustomSuggestions({ highlightedText, customRequest, fullPrompt }) {
  const fetchFn = typeof fetch !== 'undefined' ? fetch : null;

  if (!fetchFn) {
    throw new Error('Fetch API unavailable');
  }

  const response = await fetchFn(API_ENDPOINTS.CUSTOM_SUGGESTIONS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify({
      highlightedText,
      customRequest,
      fullPrompt: fullPrompt || '',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch custom suggestions: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.suggestions || [];
}

/**
 * Custom Suggestions API object (for namespace compatibility)
 */
export const customSuggestionsApi = {
  fetchCustomSuggestions,
};
