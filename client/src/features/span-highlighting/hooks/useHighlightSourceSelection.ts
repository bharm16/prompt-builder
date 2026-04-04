import { useMemo } from "react";
import { createHighlightSignature } from "./useSpanLabeling";
import type {
  SpanData,
  HighlightSourceResult,
  UseHighlightSourceSelectionOptions,
} from "./types";

// Re-export types for backward compatibility
export type {
  SpanData,
  HighlightSourceResult,
  UseHighlightSourceSelectionOptions,
} from "./types";

/**
 * Determines which persisted highlight source to use.
 */
export function useHighlightSourceSelection({
  initialHighlights,
  promptUuid,
  displayedPrompt,
  enableMLHighlighting,
}: UseHighlightSourceSelectionOptions): HighlightSourceResult | null {
  return useMemo(() => {
    if (!enableMLHighlighting) {
      return null;
    }

    const hasLocalUpdate =
      Boolean(initialHighlights?.meta) &&
      (initialHighlights?.meta as Record<string, unknown>).localUpdate === true;

    if (initialHighlights && hasLocalUpdate) {
      const resolvedSignature =
        initialHighlights.signature ??
        createHighlightSignature(displayedPrompt ?? "");

      return {
        spans: initialHighlights.spans,
        meta: initialHighlights.meta ?? null,
        signature: resolvedSignature,
        cacheId:
          initialHighlights.cacheId ?? (promptUuid ? String(promptUuid) : null),
        source: "persisted",
      };
    }

    if (initialHighlights && Array.isArray(initialHighlights.spans)) {
      const resolvedSignature =
        initialHighlights.signature ??
        createHighlightSignature(displayedPrompt ?? "");

      return {
        spans: initialHighlights.spans,
        meta: initialHighlights.meta ?? null,
        signature: resolvedSignature,
        cacheId:
          initialHighlights.cacheId ?? (promptUuid ? String(promptUuid) : null),
        source: "persisted",
      };
    }

    return null;
  }, [enableMLHighlighting, initialHighlights, promptUuid, displayedPrompt]);
}
