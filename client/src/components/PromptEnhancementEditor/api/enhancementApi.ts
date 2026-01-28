import {
  postEnhancementSuggestions,
  type EnhancementSuggestionsResponse as BaseEnhancementSuggestionsResponse,
} from '@/api/enhancementSuggestionsApi';
import { logger } from '../../../services/LoggingService';
import type { Suggestion } from '../types';
import type { EnhancementSuggestionPayload } from '../utils/suggestionPayload';

export type EnhancementSuggestionsResponse =
  BaseEnhancementSuggestionsResponse<Suggestion>;

/**
 * Fetches enhancement suggestions from the API.
 */
export async function fetchEnhancementSuggestions(
  request: EnhancementSuggestionPayload
): Promise<EnhancementSuggestionsResponse> {
  try {
    const data = await postEnhancementSuggestions<Suggestion>(request);

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
