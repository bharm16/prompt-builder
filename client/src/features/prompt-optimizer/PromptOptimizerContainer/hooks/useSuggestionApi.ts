import { useCallback, useEffect, useRef } from 'react';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { PromptOptimizer } from '@features/prompt-optimizer/context/types';
import type { SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';
import type { SuggestionContextResult } from '@features/prompt-optimizer/utils/enhancementSuggestionContext';
import { fetchEnhancementSuggestions } from '@features/prompt-optimizer/api/enhancementSuggestionsApi';
import { useEditHistory } from '@features/prompt-optimizer/hooks/useEditHistory';
import { SuggestionRequestManager } from '@features/prompt-optimizer/utils/SuggestionRequestManager';
import { prepareSpanContext } from '@features/span-highlighting/utils/spanProcessing';
import type { RawEnhancementSuggestionsResponse } from './useSuggestionCache';
import type { I2VContext } from '@features/prompt-optimizer/types/i2v';

interface UseSuggestionApiParams {
  promptOptimizer: Pick<PromptOptimizer, 'inputPrompt'>;
  stablePromptContext: PromptContext | null;
  i2vContext?: I2VContext | null;
}

interface FetchSuggestionsParams {
  dedupKey: string;
  normalizedHighlight: string;
  normalizedPrompt: string;
  suggestionContext: SuggestionContextResult;
  metadata: SuggestionsData['metadata'] | null;
  allLabeledSpans: unknown[];
  onRequestStart?: () => void;
}

const REQUEST_CONFIG = {
  debounceMs: 150,
  timeoutMs: 8000,
};

export function useSuggestionApi({
  promptOptimizer,
  stablePromptContext,
  i2vContext,
}: UseSuggestionApiParams): {
  fetchSuggestions: (params: FetchSuggestionsParams) => Promise<RawEnhancementSuggestionsResponse>;
  cancelCurrentRequest: () => void;
  isRequestInFlight: (dedupKey: string) => boolean;
} {
  const { getEditSummary } = useEditHistory();
  const requestManagerRef = useRef<SuggestionRequestManager>(
    new SuggestionRequestManager(REQUEST_CONFIG)
  );

  useEffect(() => {
    return () => {
      requestManagerRef.current.dispose();
    };
  }, []);

  const fetchSuggestions = useCallback(
    async ({
      dedupKey,
      normalizedHighlight,
      normalizedPrompt,
      suggestionContext,
      metadata,
      allLabeledSpans,
      onRequestStart,
    }: FetchSuggestionsParams): Promise<RawEnhancementSuggestionsResponse> =>
      requestManagerRef.current.scheduleRequest(dedupKey, async (signal) => {
        onRequestStart?.();

        const spanContext = prepareSpanContext(metadata, allLabeledSpans);
        const { simplifiedSpans, nearbySpans } = spanContext;

        const editHistory = getEditSummary(10);
        const i2vPayload =
          i2vContext?.isI2VMode && i2vContext.observation && i2vContext.lockMap
            ? {
                observation: i2vContext.observation as Record<string, unknown>,
                lockMap: i2vContext.lockMap as Record<string, string>,
                constraintMode: i2vContext.constraintMode,
              }
            : null;

        return fetchEnhancementSuggestions({
          highlightedText: normalizedHighlight,
          contextBefore: suggestionContext.contextBefore,
          contextAfter: suggestionContext.contextAfter,
          fullPrompt: normalizedPrompt,
          inputPrompt: promptOptimizer.inputPrompt,
          brainstormContext: stablePromptContext ?? null,
          ...(i2vPayload ? { i2vContext: i2vPayload } : {}),
          metadata: metadata ?? null,
          allLabeledSpans: simplifiedSpans,
          nearbySpans,
          editHistory,
          signal,
        });
      }),
    [getEditSummary, i2vContext, promptOptimizer.inputPrompt, stablePromptContext]
  );

  const cancelCurrentRequest = useCallback(() => {
    requestManagerRef.current.cancelCurrentRequest();
  }, []);

  const isRequestInFlight = useCallback(
    (dedupKey: string) => requestManagerRef.current.isRequestInFlight(dedupKey),
    []
  );

  return {
    fetchSuggestions,
    cancelCurrentRequest,
    isRequestInFlight,
  };
}
