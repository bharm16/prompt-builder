import { API_CONFIG } from '../../../config/api.config';
import { logger } from '../../../services/LoggingService';
import type { Suggestion } from '../types';
import type { EnhancementSuggestionPayload } from '../utils/suggestionPayload';

export interface EnhancementSuggestionsResponse {
  suggestions: Suggestion[];
  isPlaceholder: boolean;
}

/**
 * Fetches enhancement suggestions from the API.
 */
export async function fetchEnhancementSuggestions(
  request: EnhancementSuggestionPayload
): Promise<EnhancementSuggestionsResponse> {
  try {
    const response = await fetch('/api/get-enhancement-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_CONFIG.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch suggestions: ${response.status}`);
    }

    const data = (await response.json()) as { suggestions?: Suggestion[]; isPlaceholder?: boolean };

    return {
      suggestions: data.suggestions || [],
      isPlaceholder: data.isPlaceholder || false,
    };
  } catch (error) {
    logger.error('Error fetching suggestions', error as Error, {
      component: 'enhancementApi',
      operation: 'fetchEnhancementSuggestions',
      highlightedText: request.highlightedText,
      highlightCategory: request.highlightedCategory,
    });
    throw error;
  }
}
