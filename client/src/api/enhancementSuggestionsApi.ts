import { API_CONFIG } from '@/config/api.config';

export interface EnhancementSuggestionsRequest {
  highlightedText: string;
  contextBefore?: string;
  contextAfter?: string;
  fullPrompt: string;
  originalUserPrompt?: string;
  brainstormContext?: unknown | null;
  highlightedCategory?: string | null;
  highlightedCategoryConfidence?: number | null;
  highlightedPhrase?: string | null;
  allLabeledSpans?: unknown[];
  nearbySpans?: unknown[];
  editHistory?: unknown[];
}

export interface EnhancementSuggestionsResponse<TSuggestion = string> {
  suggestions: TSuggestion[];
  isPlaceholder: boolean;
}

export interface EnhancementSuggestionsFetchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function requestEnhancementSuggestions(
  payload: EnhancementSuggestionsRequest,
  options: EnhancementSuggestionsFetchOptions = {}
): Promise<Response> {
  const fetchFn = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
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
    ...(options.signal ? { signal: options.signal } : {}),
  });

  return response;
}

export async function parseEnhancementSuggestionsResponse<TSuggestion = string>(
  response: Response
): Promise<EnhancementSuggestionsResponse<TSuggestion>> {
  const data = (await response.json()) as {
    suggestions?: TSuggestion[];
    isPlaceholder?: boolean;
  };

  return {
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    isPlaceholder: data?.isPlaceholder ?? false,
  };
}

export async function postEnhancementSuggestions<TSuggestion = string>(
  payload: EnhancementSuggestionsRequest,
  options: EnhancementSuggestionsFetchOptions = {}
): Promise<EnhancementSuggestionsResponse<TSuggestion>> {
  const response = await requestEnhancementSuggestions(payload, options);

  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.status}`);
  }

  return parseEnhancementSuggestionsResponse<TSuggestion>(response);
}
