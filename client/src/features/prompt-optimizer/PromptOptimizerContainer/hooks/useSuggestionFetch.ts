/**
 * Suggestion Fetch Hook
 *
 * Handles fetching enhancement suggestions for highlighted text.
 * Extracted from useEnhancementSuggestions.js.
 *
 * Features:
 * - Request cancellation (abort in-flight requests on new selection)
 * - Deduplication (prevent duplicate requests for same text)
 * - Trailing-edge debouncing (wait for user to stop selecting)
 * - TTL-based caching (instant results for repeated selections)
 * - Proper error handling with retry capability
 *
 * Architecture: Custom React hook
 * Pattern: Single responsibility - suggestion fetching
 * Reference: VideoConceptBuilder hooks pattern
 */

import { useCallback, useRef, useEffect } from 'react';
import type React from 'react';
import { fetchEnhancementSuggestions as fetchSuggestionsAPI } from '@features/prompt-optimizer/api/enhancementSuggestionsApi';
import { prepareSpanContext } from '@features/span-highlighting/utils/spanProcessing';
import { useEditHistory } from '@features/prompt-optimizer/hooks/useEditHistory';
import { buildSuggestionContext } from '@features/prompt-optimizer/utils/enhancementSuggestionContext';
import { SuggestionRequestManager } from '@features/prompt-optimizer/utils/SuggestionRequestManager';
import { SuggestionCache, simpleHash } from '@features/prompt-optimizer/utils/SuggestionCache';
import { CancellationError } from '@features/prompt-optimizer/utils/signalUtils';
import type { Toast } from '@hooks/types';
import type { SuggestionItem, SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';

interface PromptOptimizer {
  displayedPrompt: string;
  inputPrompt: string;
  setDisplayedPrompt: (prompt: string) => void;
  setOptimizedPrompt: (prompt: string) => void;
  [key: string]: unknown;
}

interface FetchPayload {
  highlightedText?: string;
  originalText?: string;
  displayedPrompt?: string;
  range?: Range | null;
  offsets?: { start?: number; end?: number } | null;
  metadata?: SuggestionsData['metadata'];
  trigger?: string;
  allLabeledSpans?: unknown[];
}

type SetSuggestionsData = React.Dispatch<React.SetStateAction<SuggestionsData | null>>;

interface UseSuggestionFetchParams {
  promptOptimizer: PromptOptimizer;
  selectedMode: string;
  suggestionsData: SuggestionsData | null;
  setSuggestionsData: SetSuggestionsData;
  stablePromptContext: unknown;
  toast: Toast;
  handleSuggestionClick: (suggestion: SuggestionItem | string) => Promise<void>;
}

/** Response type from the enhancement suggestions API */
interface EnhancementSuggestionsResponse {
  suggestions: Array<
    | SuggestionItem
    | string
    | { suggestions?: Array<SuggestionItem | string>; category?: string }
  >;
  isPlaceholder: boolean;
}

/** Configuration for request manager and cache */
const REQUEST_CONFIG = {
  debounceMs: 150,
  timeoutMs: 8000,
};

const CACHE_CONFIG = {
  ttlMs: 300000, // 5 minutes
  maxEntries: 50,
};

const normalizeSuggestionList = (
  input: Array<
    | SuggestionItem
    | string
    | { suggestions?: Array<SuggestionItem | string>; category?: string }
  >
): SuggestionItem[] => {
  const normalized: SuggestionItem[] = [];

  input.forEach((entry) => {
    if (!entry) {
      return;
    }

    if (typeof entry === 'string') {
      normalized.push({ text: entry });
      return;
    }

    if (typeof entry !== 'object') {
      return;
    }

    const candidate = entry as SuggestionItem & {
      suggestions?: Array<SuggestionItem | string>;
      category?: string;
    };

    if (Array.isArray(candidate.suggestions)) {
      const groupCategory =
        typeof candidate.category === 'string' ? candidate.category : undefined;

      candidate.suggestions.forEach((nested) => {
        if (!nested) {
          return;
        }

        if (typeof nested === 'string') {
          normalized.push({
            text: nested,
            ...(groupCategory ? { category: groupCategory } : {}),
          });
          return;
        }

        if (typeof nested === 'object') {
          const nestedItem = nested as SuggestionItem;
          const hasCategory = typeof nestedItem.category === 'string';
          normalized.push({
            ...nestedItem,
            ...(groupCategory && !hasCategory ? { category: groupCategory } : {}),
          });
        }
      });
      return;
    }

    normalized.push(candidate);
  });

  return normalized;
};

/**
 * Hook for fetching enhancement suggestions
 * 
 * Features:
 * - Request cancellation on new selection
 * - Deduplication of in-flight requests
 * - Trailing-edge debouncing (150ms)
 * - TTL-based caching (5 minutes)
 * - Proper error handling with retry
 */
export function useSuggestionFetch({
  promptOptimizer,
  selectedMode,
  setSuggestionsData,
  stablePromptContext,
  toast,
  handleSuggestionClick,
}: UseSuggestionFetchParams): {
  fetchEnhancementSuggestions: (payload?: FetchPayload) => Promise<void>;
} {
  const { getEditSummary } = useEditHistory();

  // Request manager instance (persists across renders)
  const requestManagerRef = useRef<SuggestionRequestManager>(
    new SuggestionRequestManager(REQUEST_CONFIG)
  );

  // Cache instance (persists across renders)
  const cacheRef = useRef<SuggestionCache<EnhancementSuggestionsResponse>>(
    new SuggestionCache(CACHE_CONFIG)
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestManagerRef.current.dispose();
    };
  }, []);

  /**
   * Fetch enhancement suggestions for highlighted text
   * 
   * Flow:
   * 1. Validate input and check mode
   * 2. Check deduplication (skip if same text in-flight)
   * 3. Cancel any previous request
   * 4. Check cache (return immediately if hit)
   * 5. Schedule debounced request
   * 6. Show loading state after debounce fires
   * 7. Fetch from API with cancellation support
   * 8. Cache results and update state
   */
  const fetchEnhancementSuggestions = useCallback(
    async (payload: FetchPayload = {}): Promise<void> => {
      const {
        highlightedText,
        originalText,
        displayedPrompt: payloadPrompt,
        range,
        offsets,
        metadata: rawMetadata = null,
        allLabeledSpans = [],
      } = payload;

      const trimmedHighlight = (highlightedText || '').trim();
      const normalizedHighlight = trimmedHighlight.normalize('NFC');
      const rawPrompt = payloadPrompt ?? promptOptimizer.displayedPrompt ?? '';
      const normalizedPrompt = rawPrompt.normalize('NFC');
      const metadata: SuggestionsData['metadata'] = rawMetadata
        ? ({
            ...rawMetadata,
            span: rawMetadata.span ? { ...rawMetadata.span } : undefined,
          } as SuggestionsData['metadata'])
        : null;

      // Early returns for invalid cases
      if (selectedMode !== 'video' || !trimmedHighlight) {
        return;
      }

      const preferIndexRaw =
        metadata?.span?.start ?? metadata?.start ?? offsets?.start ?? null;
      const preferIndex =
        typeof preferIndexRaw === 'number' && Number.isFinite(preferIndexRaw)
          ? preferIndexRaw
          : null;

      const suggestionContext = buildSuggestionContext(
        normalizedPrompt,
        normalizedHighlight,
        preferIndex,
        1000
      );

      if (!suggestionContext.found) {
        console.warn(
          '[EnhancementApi] Could not locate highlight in prompt. Context may be inaccurate.'
        );
      }

      // Check cache BEFORE showing loading state - Requirement 6.3
      const contextBefore = normalizedPrompt.slice(
        Math.max(0, suggestionContext.startIndex - 100), 
        suggestionContext.startIndex
      );
      const contextAfter = normalizedPrompt.slice(
        suggestionContext.startIndex + suggestionContext.matchLength,
        suggestionContext.startIndex + suggestionContext.matchLength + 100
      );
      const cacheKey = SuggestionCache.generateKey(
        normalizedHighlight,
        contextBefore,
        contextAfter,
        simpleHash(normalizedPrompt)
      );

      // DEDUPLICATION: Use cache key to avoid duplicate in-flight requests
      const dedupKey = cacheKey;

      // Check if same request is already in-flight (prevents duplicate requests)
      if (requestManagerRef.current.isRequestInFlight(dedupKey)) {
        return; // Skip duplicate - Requirement 2.1
      }

      // Cancel any previous request (different text) - Requirement 1.1
      requestManagerRef.current.cancelCurrentRequest();

      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        // Cache hit - return immediately without API call
        const suggestionsAsObjects = normalizeSuggestionList(
          cached.suggestions ?? []
        );

        const mergeSuggestions = (
          existing: SuggestionItem[],
          incoming: SuggestionItem[]
        ): SuggestionItem[] => {
          const seen = new Set<string>();
          const out: SuggestionItem[] = [];
          const add = (s: SuggestionItem): void => {
            const key = (s?.text || '').trim().toLowerCase();
            if (!key) return;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(s);
          };
          existing.forEach(add);
          incoming.forEach(add);
          return out;
        };
        
        setSuggestionsData((prev) => {
          const baseData: SuggestionsData = {
            show: true,
            selectedText: trimmedHighlight,
            originalText: originalText || trimmedHighlight,
            suggestions: suggestionsAsObjects,
            isLoading: false,
            isError: false,
            errorMessage: null,
            isPlaceholder: cached.isPlaceholder,
            fullPrompt: normalizedPrompt,
            range: range ?? null,
            offsets: offsets ?? null,
            metadata: metadata ?? null,
            setSuggestions: (newSuggestions) => {
              setSuggestionsData((p) => {
                if (!p) return p;
                return {
                  ...p,
                  suggestions: mergeSuggestions(p.suggestions || [], newSuggestions),
                  isPlaceholder: false,
                  isError: false,
                  errorMessage: null,
                };
              });
            },
            onSuggestionClick: handleSuggestionClick,
            onClose: () => setSuggestionsData(null),
          };
          return baseData;
        });
        return;
      }

      // Retry function for error state - Requirement 3.3
      const retryFn = () => fetchEnhancementSuggestions(payload);

      // Schedule debounced request - Requirement 4.1, 4.2
      // NOTE: Loading state is shown AFTER debounce fires (inside scheduleRequest)
      try {
        const result = await requestManagerRef.current.scheduleRequest(
          dedupKey,
          async (signal) => {
            // Show loading state when request actually fires (after debounce)
            // This prevents flickering during rapid selections
            const mergeSuggestions = (
              existing: SuggestionItem[],
              incoming: SuggestionItem[]
            ): SuggestionItem[] => {
              const seen = new Set<string>();
              const out: SuggestionItem[] = [];
              const add = (s: SuggestionItem): void => {
                const key = (s?.text || '').trim().toLowerCase();
                if (!key) return;
                if (seen.has(key)) return;
                seen.add(key);
                out.push(s);
              };
              existing.forEach(add);
              incoming.forEach(add);
              return out;
            };

            setSuggestionsData(() => {
              const loadingData: SuggestionsData = {
                show: true,
                selectedText: trimmedHighlight,
                originalText: originalText || trimmedHighlight,
                suggestions: [],
                isLoading: true,
                isError: false,
                errorMessage: null,
                isPlaceholder: false,
                fullPrompt: normalizedPrompt,
                range: range ?? null,
                offsets: offsets ?? null,
                metadata: metadata ?? null,
                onRetry: retryFn,
                setSuggestions: (newSuggestions) => {
                  setSuggestionsData((p) => {
                    if (!p) return p;
                    return {
                      ...p,
                      suggestions: mergeSuggestions(p.suggestions || [], newSuggestions),
                      isPlaceholder: false,
                      isError: false,
                      errorMessage: null,
                    };
                  });
                },
                onSuggestionClick: handleSuggestionClick,
                onClose: () => setSuggestionsData(null),
              };
              return loadingData;
            });

            // Prepare span context (sanitized and validated)
            const spanContext = prepareSpanContext(
              metadata as Record<string, unknown>,
              allLabeledSpans
            ) as { simplifiedSpans: unknown[]; nearbySpans: unknown[] };
            const { simplifiedSpans, nearbySpans } = spanContext;

            // Get edit history for context
            const editHistory = getEditSummary(10);

            // Delegate to API layer with cancellation support - Requirement 1.4, 1.5
            return fetchSuggestionsAPI({
              highlightedText: normalizedHighlight,
              contextBefore: suggestionContext.contextBefore,
              contextAfter: suggestionContext.contextAfter,
              fullPrompt: normalizedPrompt,
              inputPrompt: promptOptimizer.inputPrompt,
              brainstormContext: stablePromptContext ?? null,
              metadata: metadata ?? null,
              allLabeledSpans: simplifiedSpans,
              nearbySpans: nearbySpans,
              editHistory,
              signal, // Pass abort signal for cancellation
            });
          }
        );

        const normalizedSuggestions = normalizeSuggestionList(
          result.suggestions ?? []
        );
        // Cache the result - Requirement 6.1
        cacheRef.current.set(cacheKey, {
          ...result,
          suggestions: normalizedSuggestions,
        });

        // Update state with results
        const suggestionsAsObjects = normalizedSuggestions;

        setSuggestionsData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            suggestions: suggestionsAsObjects,
            isLoading: false,
            isError: false,
            errorMessage: null,
            isPlaceholder: result.isPlaceholder,
            onRetry: retryFn,
          };
        });
      } catch (error) {
        // Silently ignore cancellation - don't update state - Requirement 1.2, 1.3
        if (error instanceof CancellationError) {
          return;
        }

        console.error('Error fetching suggestions:', error);
        toast.error('Failed to load suggestions');

        // Set error state with retry callback - Requirement 3.1, 3.3
        setSuggestionsData((prev) => {
          if (!prev) return null;
          const updated: SuggestionsData = {
            ...prev,
            isLoading: false,
            isError: true,
            errorMessage: (error as Error).message || 'Failed to load suggestions. Please try again.',
            suggestions: [],
            onRetry: retryFn, // Wire up retry callback
          };
          return updated;
        });
      }
    },
    [
      promptOptimizer,
      selectedMode,
      setSuggestionsData,
      stablePromptContext,
      toast,
      handleSuggestionClick,
      getEditSummary,
    ]
  );

  return {
    fetchEnhancementSuggestions,
  };
}
