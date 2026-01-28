import type { EnhancementSuggestionsRequest } from '@/api/enhancementSuggestionsApi';
import type { HighlightMetadata } from '../types';

export type EnhancementSuggestionPayload = EnhancementSuggestionsRequest;

function extractContext(
  fullText: string,
  highlightedText: string,
  contextSize: number = 1000
): { contextBefore: string; contextAfter: string } {
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

export function buildEnhancementSuggestionPayload(
  highlightedText: string,
  fullPrompt: string,
  originalUserPrompt: string | undefined,
  metadata: HighlightMetadata | null
): EnhancementSuggestionPayload {
  const { contextBefore, contextAfter } = extractContext(fullPrompt, highlightedText);

  const highlightCategory =
    metadata && typeof metadata.category === 'string' && metadata.category.trim().length > 0
      ? metadata.category.trim()
      : null;

  const highlightCategoryConfidence =
    metadata && typeof metadata.confidence === 'number' && Number.isFinite(metadata.confidence)
      ? Math.min(1, Math.max(0, metadata.confidence))
      : null;

  return {
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    highlightedCategory: highlightCategory,
    highlightedCategoryConfidence: highlightCategoryConfidence,
    highlightedPhrase: metadata?.phrase || null,
    ...(originalUserPrompt !== undefined ? { originalUserPrompt } : {}),
  };
}
