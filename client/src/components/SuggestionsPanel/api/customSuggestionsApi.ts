/**
 * Custom Suggestions API
 *
 * Centralized API calls for fetching custom suggestions.
 * Following VideoConceptBuilder pattern: api/videoConceptApi.ts
 * Uses Zod schemas for runtime validation at API boundaries.
 */

import { API_CONFIG } from '../../../config/api.config';
import { API_ENDPOINTS } from '../config/panelConfig';
import {
  CustomSuggestionsResponseSchema,
  type CustomSuggestionsResponse,
} from './schemas';

interface FetchCustomSuggestionsParams {
  highlightedText: string;
  customRequest: string;
  fullPrompt: string;
}

/**
 * Fetch custom suggestions from the backend
 *
 * @throws Error If API call fails
 */
export async function fetchCustomSuggestions({
  highlightedText,
  customRequest,
  fullPrompt,
}: FetchCustomSuggestionsParams): Promise<string[]> {
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
    throw new Error(
      `Failed to fetch custom suggestions: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as unknown;
  const parsed = CustomSuggestionsResponseSchema.parse(data);

  return parsed.suggestions;
}

/**
 * Custom Suggestions API object (for namespace compatibility)
 */
export const customSuggestionsApi = {
  fetchCustomSuggestions,
};

