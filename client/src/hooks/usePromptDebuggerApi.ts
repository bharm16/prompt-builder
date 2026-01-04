import { API_CONFIG } from '../config/api.config';
import type { HighlightSuggestionPayload } from './usePromptDebuggerUtils';

export async function fetchHighlightSuggestions(
  payload: HighlightSuggestionPayload,
  fetchImpl?: typeof fetch
): Promise<string[]> {
  const fetchFn = fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    throw new Error('Fetch is not available in this environment.');
  }

  const response = await fetchFn('/api/get-enhancement-suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as { suggestions?: string[] };
  return data.suggestions || [];
}
