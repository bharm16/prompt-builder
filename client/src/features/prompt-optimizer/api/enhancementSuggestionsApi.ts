/**
 * Enhancement Suggestions API
 *
 * Centralized API calls for fetching enhancement suggestions.
 * Now uses robust text relocation to ensure context is extracted correctly
 * even when whitespace/normalization differs.
 */

import { API_CONFIG } from '@config/api.config';
import { relocateQuote } from '@utils/textQuoteRelocator';

interface FetchEnhancementSuggestionsParams {
  highlightedText: string;
  normalizedPrompt: string;
  inputPrompt: string;
  brainstormContext?: unknown | null;
  metadata?: {
    startIndex?: number;
    category?: string;
    confidence?: number;
    quote?: string;
  } | null;
  allLabeledSpans?: unknown[];
  nearbySpans?: unknown[];
  editHistory?: unknown[];
}

interface EnhancementSuggestionsResponse {
  suggestions: string[];
  isPlaceholder: boolean;
}

/**
 * Fetch enhancement suggestions for highlighted text
 */
export async function fetchEnhancementSuggestions({
  highlightedText,
  normalizedPrompt,
  inputPrompt,
  brainstormContext = null,
  metadata = null,
  allLabeledSpans = [],
  nearbySpans = [],
  editHistory = [],
}: FetchEnhancementSuggestionsParams): Promise<EnhancementSuggestionsResponse> {
  // 1. ROBUST LOCATION FINDING
  // Instead of a brittle indexOf, we use the robust relocator.
  // This handles cases where the UI's "highlightedText" might have different
  // invisible whitespace than the "normalizedPrompt" stored in state.
  const location = relocateQuote({
    text: normalizedPrompt,
    quote: highlightedText,
    // We don't have left/right context yet (we are trying to find it!),
    // so we rely on the relocator's fuzzy matching.
    // If metadata provides a hint (like a previous index), we could use it here.
    preferIndex: metadata?.startIndex ?? null,
  });

  let highlightIndex = -1;
  let matchLength = highlightedText.length;

  if (location) {
    highlightIndex = location.start;
    matchLength = location.end - location.start;
  } else {
    // Fallback to strict match if fuzzy fails (unlikely)
    highlightIndex = normalizedPrompt.indexOf(highlightedText);
  }

  // 2. CONTEXT EXTRACTION
  // If we still can't find it, we default to 0 to avoid crashing,
  // but log a warning as this will likely degrade suggestion quality.
  if (highlightIndex === -1) {
    console.warn(
      '[EnhancementApi] Could not locate highlight in prompt. Context may be inaccurate.'
    );
    highlightIndex = 0;
  }

  // Extract context (up to 1000 chars)
  const contextBefore = normalizedPrompt
    .substring(Math.max(0, highlightIndex - 1000), highlightIndex)
    .trim();

  const contextAfter = normalizedPrompt
    .substring(
      highlightIndex + matchLength,
      Math.min(
        normalizedPrompt.length,
        highlightIndex + matchLength + 1000
      )
    )
    .trim();

  // 3. MAKE API CALL
  const response = await fetch('/api/get-enhancement-suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify({
      highlightedText, // The text we want to change
      contextBefore, // The text leading up to it (CRITICAL for LLM)
      contextAfter, // The text following it
      fullPrompt: normalizedPrompt,
      originalUserPrompt: inputPrompt,
      brainstormContext:
        brainstormContext &&
        typeof brainstormContext === 'object' &&
        'toJSON' in brainstormContext &&
        typeof (brainstormContext as { toJSON?: () => unknown }).toJSON ===
          'function'
          ? (brainstormContext as { toJSON: () => unknown }).toJSON()
          : brainstormContext,
      highlightedCategory: metadata?.category || null,
      highlightedCategoryConfidence: metadata?.confidence || null,
      highlightedPhrase: metadata?.quote || highlightedText,
      allLabeledSpans,
      nearbySpans,
      editHistory,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.status}`);
  }

  const data = (await response.json()) as EnhancementSuggestionsResponse;

  return {
    suggestions: data.suggestions || [],
    isPlaceholder: data.isPlaceholder || false,
  };
}

export const enhancementSuggestionsApi = {
  fetchEnhancementSuggestions,
};

