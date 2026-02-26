import { useCallback, useRef } from 'react';
import type { EnhancementSuggestionsResponse as BaseEnhancementSuggestionsResponse } from '@/api/enhancementSuggestionsApi';
import type { SuggestionItem } from '@features/prompt-optimizer/PromptCanvas/types';
import type { SuggestionContextResult } from '@features/prompt-optimizer/utils/enhancementSuggestionContext';
import { SuggestionCache, simpleHash } from '@features/prompt-optimizer/utils/SuggestionCache';
import {
  normalizeSuggestionList,
  type EnhancementSuggestionEntry,
} from '../utils/normalizeSuggestionList';

export {
  normalizeSuggestionList,
  type EnhancementSuggestionEntry,
} from '../utils/normalizeSuggestionList';

export type RawEnhancementSuggestionsResponse =
  BaseEnhancementSuggestionsResponse<EnhancementSuggestionEntry>;

export type NormalizedEnhancementSuggestionsResponse =
  BaseEnhancementSuggestionsResponse<SuggestionItem>;

interface CacheKeyInput {
  normalizedHighlight: string;
  normalizedPrompt: string;
  suggestionContext: SuggestionContextResult;
  contextWindow?: number;
  category?: string | null;
  spanFingerprint?: string | null;
  i2vKey?: string | null;
}

const CACHE_CONFIG = {
  ttlMs: 300000, // 5 minutes
  maxEntries: 50,
};

const DEFAULT_CACHE_CONTEXT_WINDOW = 100;

const normalizeResponse = (
  response: RawEnhancementSuggestionsResponse
): NormalizedEnhancementSuggestionsResponse => ({
  ...response,
  suggestions: normalizeSuggestionList(response.suggestions ?? []),
});

export function useSuggestionCache(): {
  buildCacheKey: (input: CacheKeyInput) => string;
  getCachedSuggestions: (cacheKey: string) => NormalizedEnhancementSuggestionsResponse | null;
  setCachedSuggestions: (
    cacheKey: string,
    response: RawEnhancementSuggestionsResponse
  ) => NormalizedEnhancementSuggestionsResponse;
} {
  const cacheRef = useRef<SuggestionCache<NormalizedEnhancementSuggestionsResponse>>(
    new SuggestionCache(CACHE_CONFIG)
  );

  const buildCacheKey = useCallback(
    ({
      normalizedHighlight,
      normalizedPrompt,
      suggestionContext,
      contextWindow = DEFAULT_CACHE_CONTEXT_WINDOW,
      category = null,
      spanFingerprint = null,
      i2vKey = null,
    }: CacheKeyInput): string => {
      const contextBefore = normalizedPrompt.slice(
        Math.max(0, suggestionContext.startIndex - contextWindow),
        suggestionContext.startIndex
      );
      const contextAfter = normalizedPrompt.slice(
        suggestionContext.startIndex + suggestionContext.matchLength,
        suggestionContext.startIndex + suggestionContext.matchLength + contextWindow
      );

      const categoryKey =
        typeof category === 'string' ? category.trim().toLowerCase() : '';
      const spanKey =
        typeof spanFingerprint === 'string' ? spanFingerprint : '';
      const promptHash = simpleHash(
        `${normalizedPrompt}|${categoryKey}|${spanKey}|${i2vKey ?? ''}`
      );

      return SuggestionCache.generateKey(
        normalizedHighlight,
        contextBefore,
        contextAfter,
        promptHash
      );
    },
    []
  );

  const getCachedSuggestions = useCallback(
    (cacheKey: string): NormalizedEnhancementSuggestionsResponse | null =>
      cacheRef.current.get(cacheKey),
    []
  );

  const setCachedSuggestions = useCallback(
    (
      cacheKey: string,
      response: RawEnhancementSuggestionsResponse
    ): NormalizedEnhancementSuggestionsResponse => {
      const normalized = normalizeResponse(response);
      cacheRef.current.set(cacheKey, normalized);
      return normalized;
    },
    []
  );

  return {
    buildCacheKey,
    getCachedSuggestions,
    setCachedSuggestions,
  };
}
