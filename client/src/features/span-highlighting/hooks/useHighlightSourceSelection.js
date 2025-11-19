import { useMemo } from 'react';
import { createHighlightSignature } from './useSpanLabeling.js';

/**
 * Determines which highlight source to use based on priority:
 * 1. Draft spans (instant ~300ms highlights)
 * 2. Refined spans (updated after refinement completes)
 * 3. Persisted spans (loaded from history)
 * 
 * @param {Object} params
 * @param {Object} params.draftSpans - Spans from parallel draft execution
 * @param {Object} params.refinedSpans - Spans from refined text
 * @param {boolean} params.isDraftReady - Whether draft text is ready
 * @param {boolean} params.isRefining - Whether refinement is in progress
 * @param {Object} params.initialHighlights - Persisted highlights from storage
 * @param {string} params.promptUuid - Unique prompt identifier
 * @param {string} params.displayedPrompt - Current displayed text
 * @param {boolean} params.enableMLHighlighting - Whether ML highlighting is enabled
 * @param {number} params.initialHighlightsVersion - Version for cache invalidation
 * @returns {Object|null} Selected highlight data or null
 */
export function useHighlightSourceSelection({
  draftSpans,
  refinedSpans,
  isDraftReady,
  isRefining,
  initialHighlights,
  promptUuid,
  displayedPrompt,
  enableMLHighlighting,
  initialHighlightsVersion,
}) {
  return useMemo(() => {
    if (!enableMLHighlighting) {
      return null;
    }

    // PRIORITY 1: Use draft spans if available and we're showing draft text
    // This provides instant highlights at ~300ms
    if (draftSpans && isDraftReady && !refinedSpans) {
      const signature = createHighlightSignature(displayedPrompt ?? '');
      return {
        spans: draftSpans.spans || [],
        meta: draftSpans.meta || null,
        signature,
        cacheId: promptUuid ? String(promptUuid) : null,
        source: 'draft',
      };
    }

    // PRIORITY 2: Use refined spans if available
    // This provides updated highlights when refinement completes
    if (refinedSpans && !isRefining) {
      const signature = createHighlightSignature(displayedPrompt ?? '');
      return {
        spans: refinedSpans.spans || [],
        meta: refinedSpans.meta || null,
        signature,
        cacheId: promptUuid ? String(promptUuid) : null,
        source: 'refined',
      };
    }

    // PRIORITY 3: Fallback to persisted highlights (e.g., loaded from history)
    if (initialHighlights && Array.isArray(initialHighlights.spans)) {
      const resolvedSignature =
        initialHighlights.signature ?? createHighlightSignature(displayedPrompt ?? '');

      return {
        spans: initialHighlights.spans,
        meta: initialHighlights.meta ?? null,
        signature: resolvedSignature,
        cacheId: initialHighlights.cacheId ?? (promptUuid ? String(promptUuid) : null),
        source: 'persisted',
      };
    }

    return null;
  }, [
    enableMLHighlighting,
    draftSpans,
    refinedSpans,
    isDraftReady,
    isRefining,
    initialHighlights,
    initialHighlightsVersion,
    promptUuid,
    displayedPrompt,
  ]);
}

