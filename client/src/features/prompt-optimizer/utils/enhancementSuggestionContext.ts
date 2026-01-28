import { relocateQuote } from '@utils/textQuoteRelocator';

interface ResolveHighlightLocationParams {
  normalizedPrompt: string;
  highlightedText: string;
  preferIndex?: number | null;
}

export interface HighlightLocationResult {
  startIndex: number;
  matchLength: number;
  found: boolean;
  usedFallback: boolean;
}

export interface SuggestionContextResult extends HighlightLocationResult {
  contextBefore: string;
  contextAfter: string;
}

export function resolveHighlightLocation({
  normalizedPrompt,
  highlightedText,
  preferIndex = null,
}: ResolveHighlightLocationParams): HighlightLocationResult {
  const location = relocateQuote({
    text: normalizedPrompt,
    quote: highlightedText,
    preferIndex,
  });

  if (location) {
    return {
      startIndex: location.start,
      matchLength: location.end - location.start,
      found: true,
      usedFallback: false,
    };
  }

  const fallbackIndex = normalizedPrompt.indexOf(highlightedText);
  if (fallbackIndex !== -1) {
    return {
      startIndex: fallbackIndex,
      matchLength: highlightedText.length,
      found: true,
      usedFallback: true,
    };
  }

  return {
    startIndex: 0,
    matchLength: highlightedText.length,
    found: false,
    usedFallback: true,
  };
}

export function buildSuggestionContext(
  normalizedPrompt: string,
  highlightedText: string,
  preferIndex: number | null,
  contextSize: number = 1000
): SuggestionContextResult {
  const resolved = resolveHighlightLocation({
    normalizedPrompt,
    highlightedText,
    preferIndex,
  });

  const contextBefore = normalizedPrompt
    .substring(Math.max(0, resolved.startIndex - contextSize), resolved.startIndex)
    .trim();

  const contextAfter = normalizedPrompt
    .substring(
      resolved.startIndex + resolved.matchLength,
      Math.min(normalizedPrompt.length, resolved.startIndex + resolved.matchLength + contextSize)
    )
    .trim();

  return {
    ...resolved,
    contextBefore,
    contextAfter,
  };
}
