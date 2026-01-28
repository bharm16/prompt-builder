import {
  requestEnhancementSuggestions,
  parseEnhancementSuggestionsResponse,
} from '@/api/enhancementSuggestionsApi';
import type { HighlightSuggestionPayload } from './usePromptDebuggerUtils';

export async function fetchHighlightSuggestions(
  payload: HighlightSuggestionPayload,
  fetchImpl?: typeof fetch
): Promise<string[]> {
  const response = await requestEnhancementSuggestions(
    payload,
    fetchImpl ? { fetchImpl } : {}
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await parseEnhancementSuggestionsResponse<string>(response);
  return data.suggestions || [];
}
