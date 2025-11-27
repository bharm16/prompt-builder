/**
 * useSpanDataConversion Hook
 * 
 * Handles conversion of span data formats and memoization.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useMemo } from 'react';
import { useHighlightSourceSelection } from '../../../span-highlighting/hooks/useHighlightSourceSelection';
import type { SpanData } from '../../../span-highlighting/hooks/useHighlightSourceSelection';
import type { SpansData, HighlightSnapshot } from '../types';
import {
  convertSpansDataToSpanData,
  convertHighlightSnapshotToSpanData,
  convertHighlightSnapshotToSourceSelectionOptions,
} from '../utils/spanDataConversion';

export interface UseSpanDataConversionOptions {
  draftSpans: SpansData | null;
  refinedSpans: SpansData | null;
  initialHighlights: HighlightSnapshot | null;
  isDraftReady: boolean;
  isRefining: boolean;
  promptUuid: string | null;
  displayedPrompt: string | null;
  enableMLHighlighting: boolean;
  initialHighlightsVersion: number;
}

export interface UseSpanDataConversionReturn {
  convertedDraftSpans: SpanData | null;
  convertedRefinedSpans: SpanData | null;
  convertedInitialHighlights: {
    spans: Array<{
      start: number;
      end: number;
      category: string;
      confidence: number;
    }>;
    meta?: Record<string, unknown> | null;
    signature?: string;
    cacheId?: string | null;
  } | null;
  memoizedInitialHighlights: ReturnType<typeof useHighlightSourceSelection>;
}

export function useSpanDataConversion({
  draftSpans,
  refinedSpans,
  initialHighlights,
  isDraftReady,
  isRefining,
  promptUuid,
  displayedPrompt,
  enableMLHighlighting,
  initialHighlightsVersion,
}: UseSpanDataConversionOptions): UseSpanDataConversionReturn {
  const convertedDraftSpans = useMemo(
    () => convertSpansDataToSpanData(draftSpans),
    [draftSpans]
  );

  const convertedRefinedSpans = useMemo(
    () => convertSpansDataToSpanData(refinedSpans),
    [refinedSpans]
  );

  const convertedInitialHighlights = useMemo(
    () => convertHighlightSnapshotToSourceSelectionOptions(initialHighlights),
    [initialHighlights]
  );

  const memoizedInitialHighlights = useHighlightSourceSelection({
    draftSpans: convertedDraftSpans,
    refinedSpans: convertedRefinedSpans,
    isDraftReady,
    isRefining,
    initialHighlights: convertedInitialHighlights,
    promptUuid,
    displayedPrompt,
    enableMLHighlighting,
    initialHighlightsVersion,
  });

  return {
    convertedDraftSpans,
    convertedRefinedSpans,
    convertedInitialHighlights,
    memoizedInitialHighlights,
  };
}

