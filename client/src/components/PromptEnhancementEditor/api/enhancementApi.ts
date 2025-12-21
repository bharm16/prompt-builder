import { API_CONFIG } from '../../../config/api.config';
import { logger } from '../../../services/LoggingService';
import type { HighlightMetadata, Suggestion } from '../types';

export interface EnhancementSuggestionsRequest {
  highlightedText: string;
  fullPrompt: string;
  originalUserPrompt?: string | undefined;
  metadata: HighlightMetadata | null;
}

export interface EnhancementSuggestionsResponse {
  suggestions: Suggestion[];
  isPlaceholder: boolean;
}

/**
 * Extracts context around highlighted text for richer semantic understanding.
 */
function extractContext(fullText: string, highlightedText: string, contextSize: number = 1000): {
  contextBefore: string;
  contextAfter: string;
} {
  const highlightIndex = fullText.indexOf(highlightedText);
  
  const contextBefore = fullText
    .substring(Math.max(0, highlightIndex - contextSize), highlightIndex)
    .trim();

  const contextAfter = fullText
    .substring(
      highlightIndex + highlightedText.length,
      Math.min(fullText.length, highlightIndex + highlightedText.length + contextSize)
    )
    .trim();

  return { contextBefore, contextAfter };
}

/**
 * Fetches enhancement suggestions from the API.
 */
export async function fetchEnhancementSuggestions(
  request: EnhancementSuggestionsRequest
): Promise<EnhancementSuggestionsResponse> {
  const { highlightedText, fullPrompt, originalUserPrompt, metadata } = request;
  const { contextBefore, contextAfter } = extractContext(fullPrompt, highlightedText);

  const highlightCategory =
    metadata && typeof metadata.category === 'string' && metadata.category.trim().length > 0
      ? metadata.category.trim()
      : null;
      
  const highlightCategoryConfidence =
    metadata && typeof metadata.confidence === 'number' && Number.isFinite(metadata.confidence)
      ? Math.min(1, Math.max(0, metadata.confidence))
      : null;

  try {
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
        fullPrompt,
        originalUserPrompt,
        highlightedCategory: highlightCategory,
        highlightedCategoryConfidence: highlightCategoryConfidence,
        highlightedPhrase: metadata?.phrase || null,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch suggestions');
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
      highlightedText,
      highlightCategory,
    });

    return {
      suggestions: [{ text: 'Failed to load suggestions. Please try again.' }],
      isPlaceholder: false,
    };
  }
}
