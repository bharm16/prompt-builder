/**
 * Custom Suggestions API
 *
 * Centralized API calls for fetching custom suggestions.
 * Following VideoConceptBuilder pattern: api/videoConceptApi.ts
 * Uses Zod schemas for runtime validation at API boundaries.
 *
 * Features:
 * - Request cancellation via AbortSignal
 * - 3-second timeout for suggestions requests
 * - Distinguishes timeout vs user cancellation in error handling
 */

import { API_ENDPOINTS } from '../config/panelConfig';
import {
  CustomSuggestionsResponseSchema,
  type CustomSuggestionsResponse,
} from './schemas';
import { CancellationError, combineSignals } from '@features/prompt-optimizer/utils/signalUtils';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

/** Timeout for custom suggestion requests in milliseconds */
const CUSTOM_SUGGESTION_TIMEOUT_MS = 3000;

interface FetchCustomSuggestionsParams {
  highlightedText: string;
  customRequest: string;
  fullPrompt: string;
  contextBefore?: string;
  contextAfter?: string;
  metadata?: Record<string, unknown> | null;
  /** Optional AbortSignal for external cancellation */
  signal?: AbortSignal;
}

/**
 * Fetch custom suggestions from the backend
 *
 * @param params - Parameters including highlighted text, custom request, and optional abort signal
 * @returns Promise resolving to array of suggestion strings
 * @throws CancellationError if request is cancelled by user
 * @throws Error if request times out or network error occurs
 */
export async function fetchCustomSuggestions({
  highlightedText,
  customRequest,
  fullPrompt,
  contextBefore,
  contextAfter,
  metadata,
  signal: externalSignal,
}: FetchCustomSuggestionsParams): Promise<string[]> {
  const fetchFn = typeof fetch !== 'undefined' ? fetch : null;

  if (!fetchFn) {
    throw new Error('Fetch API unavailable');
  }

  // Create timeout controller for 3-second timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new Error('Request timeout'));
  }, CUSTOM_SUGGESTION_TIMEOUT_MS);

  // Combine external signal (user cancellation) with timeout signal
  const signal = externalSignal
    ? combineSignals(externalSignal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const authHeaders = await buildFirebaseAuthHeaders();
    const response = await fetchFn(API_ENDPOINTS.CUSTOM_SUGGESTIONS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        highlightedText,
        customRequest,
        fullPrompt: fullPrompt || '',
        contextBefore,
        contextAfter,
        metadata: metadata ?? undefined,
      }),
      signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch custom suggestions: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as unknown;
    const parsed = CustomSuggestionsResponseSchema.parse(data);

    return parsed.suggestions;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle AbortError - distinguish between timeout and user cancellation
    if (error instanceof Error && error.name === 'AbortError') {
      // Check if this was a timeout (our internal abort) vs user cancellation (external signal)
      const isTimeout =
        timeoutController.signal.aborted &&
        (!externalSignal || !externalSignal.aborted);

      if (isTimeout) {
        // Timeout should be treated as an error, not silent cancellation
        throw new Error('Request timed out after 3 seconds');
      }

      // User cancellation - throw CancellationError for silent handling
      throw new CancellationError('Request cancelled by user');
    }

    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Custom Suggestions API object (for namespace compatibility)
 */
export const customSuggestionsApi = {
  fetchCustomSuggestions,
};
