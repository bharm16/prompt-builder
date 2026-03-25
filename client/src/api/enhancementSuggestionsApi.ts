import { z } from "zod";

import { buildFirebaseAuthHeaders } from "@/services/http/firebaseAuth";

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
  i2vContext?: {
    observation: Record<string, unknown>;
    lockMap: Record<string, string>;
    constraintMode?: "strict" | "flexible" | "transform";
  } | null;
}

const EnhancementSuggestionsResponseSchema = z
  .object({
    suggestions: z.array(z.unknown()).default([]),
    isPlaceholder: z.boolean().default(false),
    spanFingerprint: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    _debug: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

export type EnhancementSuggestionsResponse<TSuggestion = string> = {
  suggestions: TSuggestion[];
  isPlaceholder: boolean;
  spanFingerprint?: string | null;
  metadata?: Record<string, unknown> | null;
  _debug?: Record<string, unknown> | null;
};

export interface EnhancementSuggestionsFetchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function requestEnhancementSuggestions(
  payload: EnhancementSuggestionsRequest,
  options: EnhancementSuggestionsFetchOptions = {},
): Promise<Response> {
  const fetchFn =
    options.fetchImpl || (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fetchFn) {
    throw new Error("Fetch is not available in this environment.");
  }

  const authHeaders = await buildFirebaseAuthHeaders();
  const debugHeaders = import.meta.env.DEV ? { "x-debug": "true" } : {};
  const response = await fetchFn("/api/get-enhancement-suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...debugHeaders,
    },
    body: JSON.stringify(payload),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  return response;
}

export async function parseEnhancementSuggestionsResponse<TSuggestion = string>(
  response: Response,
): Promise<EnhancementSuggestionsResponse<TSuggestion>> {
  const data = await response.json();
  const parsed = EnhancementSuggestionsResponseSchema.parse(data);

  return {
    suggestions: parsed.suggestions as TSuggestion[],
    isPlaceholder: parsed.isPlaceholder,
    ...(typeof parsed.spanFingerprint === "string"
      ? { spanFingerprint: parsed.spanFingerprint }
      : {}),
    ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
    ...(parsed._debug ? { _debug: parsed._debug } : {}),
  };
}

export async function postEnhancementSuggestions<TSuggestion = string>(
  payload: EnhancementSuggestionsRequest,
  options: EnhancementSuggestionsFetchOptions = {},
): Promise<EnhancementSuggestionsResponse<TSuggestion>> {
  const response = await requestEnhancementSuggestions(payload, options);

  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.status}`);
  }

  return parseEnhancementSuggestionsResponse<TSuggestion>(response);
}
