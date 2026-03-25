/**
 * useSpanDataConversion Hook
 *
 * Handles conversion of span data formats and memoization.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useMemo } from "react";
import { useHighlightSourceSelection } from "@features/span-highlighting/hooks/useHighlightSourceSelection";
import type { HighlightSnapshot } from "../types";
import { convertHighlightSnapshotToSourceSelectionOptions } from "../utils/spanDataConversion";

export interface UseSpanDataConversionOptions {
  initialHighlights: HighlightSnapshot | null;
  promptUuid: string | null;
  displayedPrompt: string | null;
  enableMLHighlighting: boolean;
  initialHighlightsVersion: number;
}

export interface UseSpanDataConversionReturn {
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
  initialHighlights,
  promptUuid,
  displayedPrompt,
  enableMLHighlighting,
  initialHighlightsVersion,
}: UseSpanDataConversionOptions): UseSpanDataConversionReturn {
  const convertedInitialHighlights = useMemo(
    () => convertHighlightSnapshotToSourceSelectionOptions(initialHighlights),
    [initialHighlights],
  );

  const memoizedInitialHighlights = useHighlightSourceSelection({
    initialHighlights: convertedInitialHighlights,
    promptUuid,
    displayedPrompt,
    enableMLHighlighting,
    initialHighlightsVersion,
  });

  return {
    convertedInitialHighlights,
    memoizedInitialHighlights,
  };
}
