/**
 * useHighlightRendering Hook
 * 
 * Manages DOM manipulation for applying highlight spans in the editor.
 * Uses DIFF-BASED RENDERING to eliminate DOM thrashing.
 * 
 * PERFORMANCE OPTIMIZATION:
 * Instead of clearing all highlights and rebuilding on every change,
 * this implementation:
 * 1. Tracks spans by stable ID (from backend)
 * 2. Only removes deleted spans
 * 3. Only adds new spans
 * 4. Only updates changed spans (position/text changes)
 * 
 * This eliminates flickering and improves performance with 50+ highlights.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { logger } from '@/services/LoggingService';
import { PromptContext } from '@utils/PromptContext';
import {
  buildTextNodeIndex,
  wrapRangeSegments,
  processAndSortSpans,
  validateHighlightText,
  createHighlightWrapper,
  enhanceWrapperWithMetadata,
  unwrapHighlight,
  logEmptyWrappers,
  hasOverlap,
  addToCoverage,
} from '../utils/index.ts';
import { PERFORMANCE_MARKS, PERFORMANCE_MEASURES, DEBUG_HIGHLIGHTS } from '../config/index.ts';
import type {
  HighlightSpan,
  ParseResult,
  TextNodeIndex,
  SpanEntry,
  HighlightState,
  UseHighlightRenderingOptions,
} from './types';

// Re-export types for backward compatibility
export type {
  HighlightSpan,
  ParseResult,
  UseHighlightRenderingOptions,
} from './types';

const log = logger.child('HighlightRendering');

/**
 * Custom hook for rendering highlights in the editor
 */
export function useHighlightRendering({
  editorRef,
  parseResult,
  enabled,
  fingerprint,
  text,
}: UseHighlightRenderingOptions): React.RefObject<HighlightState> {
  const highlightStateRef = useRef<HighlightState>({
    spanMap: new Map(), // Maps span.id -> { span, wrappers: [] }
    nodeIndex: null,
    fingerprint: null,
  });
  const [renderRetryTick, setRenderRetryTick] = useState(0);
  const retryFrameRef = useRef<number | null>(null);
  const retryKeyRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const errorKeyRef = useRef<string | null>(null);

  const scheduleRetry = useCallback((key: string): void => {
    if (retryKeyRef.current !== key) {
      retryKeyRef.current = key;
      retryCountRef.current = 0;
    }
    if (retryCountRef.current >= 2) {
      return;
    }
    if (retryFrameRef.current !== null) {
      return;
    }
    retryCountRef.current += 1;
    retryFrameRef.current = requestAnimationFrame(() => {
      retryFrameRef.current = null;
      setRenderRetryTick((prev) => prev + 1);
    });
  }, []);

  /**
   * Helper: Check if a span has changed (position or text)
   */
  const hasSpanChanged = (existingSpan: HighlightSpan, newSpan: HighlightSpan): boolean => {
    return (
      existingSpan.start !== newSpan.start ||
      existingSpan.end !== newSpan.end ||
      existingSpan.text !== newSpan.text ||
      existingSpan.quote !== newSpan.quote ||
      existingSpan.displayQuote !== newSpan.displayQuote
    );
  };

  /**
   * Clear all highlights (used only on unmount or disable)
   */
  const clearAllHighlights = (): void => {
    const { spanMap } = highlightStateRef.current;
    for (const { wrappers } of spanMap.values()) {
      if (wrappers?.length) {
        wrappers.forEach((wrapper) => unwrapHighlight(wrapper));
      }
    }
    highlightStateRef.current = { 
      spanMap: new Map(), 
      nodeIndex: null, 
      fingerprint: null 
    };
  };

  // Clean up on unmount
  useEffect(() => () => clearAllHighlights(), []);
  useEffect(
    () => () => {
      if (retryFrameRef.current !== null) {
        cancelAnimationFrame(retryFrameRef.current);
      }
    },
    []
  );

  // Main highlighting effect - DIFF-BASED RENDERING
  useLayoutEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    try {
      // Handle disabled state
      if (!enabled) {
        if (highlightStateRef.current.spanMap.size > 0) {
          clearAllHighlights();
        } else {
          highlightStateRef.current.fingerprint = null;
        }
        errorKeyRef.current = null;
        return;
      }

      // Validate and extract spans
      const spans = Array.isArray(parseResult?.spans) ? parseResult.spans : [];
      const previousFingerprint = highlightStateRef.current.fingerprint;

      // Handle empty spans
      if (!spans.length) {
        if (highlightStateRef.current.spanMap.size > 0) {
          clearAllHighlights();
        }
        highlightStateRef.current.fingerprint = fingerprint ?? null;
        errorKeyRef.current = null;
        return;
      }

      // Skip if fingerprint unchanged
      if (fingerprint && previousFingerprint === fingerprint) {
        return;
      }

      // Validate display text - use passed text prop to avoid DOM reads
      const displayText = parseResult?.displayText ?? text ?? '';
      if (!displayText) {
        if (highlightStateRef.current.spanMap.size > 0) {
          clearAllHighlights();
        }
        highlightStateRef.current.fingerprint = fingerprint ?? null;
        errorKeyRef.current = null;
        return;
      }

      const retryKey = fingerprint ?? displayText;
      if (errorKeyRef.current && errorKeyRef.current === retryKey) {
        return;
      }

      const rootText = root.textContent ?? '';
      if (rootText !== displayText) {
        if (highlightStateRef.current.spanMap.size > 0) {
          clearAllHighlights();
        }
        scheduleRetry(retryKey);
        return;
      }

      // ⏱️ PERFORMANCE TIMER: Highlight rendering starts
      const highlightRenderStart = performance.now();

      // Get current state
      const { spanMap } = highlightStateRef.current;
      
      // Process and sort incoming spans
      const sortedSpans = processAndSortSpans(spans, displayText);
      let skippedOverlap = 0;
      let skippedMismatch = 0;
      let skippedEmptyWrapper = 0;
      
      // Create a set of new span IDs
      const newSpanIds = new Set<string>();
      const newSpansBySpanId = new Map<string, HighlightSpan>();
      
      sortedSpans.forEach(({ span }) => {
        // Use span.id if available (from backend), or fall back to composite key
        const spanId = span.id || `${span.start}-${span.end}-${span.category || span.role || ''}`;
        newSpanIds.add(spanId);
        newSpansBySpanId.set(spanId, span);
      });

      // PHASE 1: Remove deleted spans
      for (const [spanId, { wrappers }] of spanMap.entries()) {
        if (!newSpanIds.has(spanId)) {
          // Span was deleted - unwrap it
          if (wrappers?.length) {
            wrappers.forEach((wrapper) => unwrapHighlight(wrapper));
          }
          spanMap.delete(spanId);
        }
      }

      // PHASE 2 & 3: Add new spans and update changed spans
      const coverage: Array<{ start: number; end: number }> = [];
      let nodeIndex: TextNodeIndex | null = buildTextNodeIndex(root);
      highlightStateRef.current.nodeIndex = nodeIndex;

      if (!nodeIndex.nodes.length) {
        scheduleRetry(retryKey);
        return;
      }

      sortedSpans.forEach(({ span, highlightStart, highlightEnd }) => {
        const spanId = span.id || `${span.start}-${span.end}-${span.category || span.role || ''}`;
        const existingEntry = spanMap.get(spanId);

        // Skip overlapping spans
        if (hasOverlap(coverage, highlightStart, highlightEnd)) {
          skippedOverlap += 1;
          return;
        }

        // Extract and validate text
        const expectedText = span.displayQuote ?? span.quote ?? '';
        const actualSlice = displayText.slice(highlightStart, highlightEnd);

        if (!validateHighlightText(expectedText, actualSlice, span, highlightStart, highlightEnd)) {
          skippedMismatch += 1;
          return;
        }

        // Determine if we need to render/re-render
        let shouldRender = false;
        const wrappersMissing =
          !existingEntry?.wrappers?.length ||
          existingEntry.wrappers.some((wrapper) => !root.contains(wrapper));

        if (!existingEntry) {
          shouldRender = true;
        } else if (hasSpanChanged(existingEntry.span, span) || wrappersMissing) {
          if (existingEntry.wrappers?.length) {
            existingEntry.wrappers.forEach((wrapper) => unwrapHighlight(wrapper));
          }
          shouldRender = true;
        }

        if (shouldRender) {

          // Create wrapper elements
          const segmentWrappers = wrapRangeSegments({
            root,
            start: highlightStart,
            end: highlightEnd,
            nodeIndex,
            createWrapper: () =>
              createHighlightWrapper(
                root,
                span,
                highlightStart,
                highlightEnd,
                (category?: string) => (category ? PromptContext.getCategoryColor(category) : undefined)
              ),
          });

          // Handle empty wrappers
          if (!segmentWrappers.length) {
            logEmptyWrappers(span, highlightStart, highlightEnd, nodeIndex, root);
            skippedEmptyWrapper += 1;
            spanMap.delete(spanId);
            return;
          }

          // Enhance wrappers with metadata
          segmentWrappers.forEach((wrapper) => {
            enhanceWrapperWithMetadata(wrapper, span);
          });

          // Store in spanMap
          spanMap.set(spanId, {
            span,
            wrappers: segmentWrappers,
          });
        }

        // Track coverage
        addToCoverage(coverage, highlightStart, highlightEnd);
      });

      if (DEBUG_HIGHLIGHTS) {
        const skippedTotal = skippedOverlap + skippedMismatch + skippedEmptyWrapper;
        const renderedSpanCount = spanMap.size;
        if (sortedSpans.length > 1 && (renderedSpanCount <= 1 || skippedTotal > 0)) {
          log.debug('Highlight rendering summary', {
            attemptedSpanCount: sortedSpans.length,
            renderedSpanCount,
            skippedOverlap,
            skippedMismatch,
            skippedEmptyWrapper,
            fingerprint: fingerprint ?? null,
            textLength: displayText.length,
          });
        }
      }

      // Update fingerprint
      highlightStateRef.current.fingerprint = fingerprint ?? null;
      errorKeyRef.current = null;

      // ⏱️ CRITICAL PERFORMANCE TIMER: Highlights are now visible on screen!
      const highlightRenderEnd = performance.now();
      performance.mark(PERFORMANCE_MARKS.HIGHLIGHTS_VISIBLE);

      // Measure from prompt displayed to highlights visible
      try {
        performance.measure(
          PERFORMANCE_MEASURES.PROMPT_TO_HIGHLIGHTS,
          PERFORMANCE_MARKS.PROMPT_DISPLAYED,
          PERFORMANCE_MARKS.HIGHLIGHTS_VISIBLE
        );
      } catch (err) {
        // Mark may not exist if prompt wasn't displayed yet
      }
    } catch (error) {
      log.error('Highlight rendering failed', error as Error, {
        fingerprint: fingerprint ?? null,
        textLength: (parseResult?.displayText ?? text ?? '').length,
      });
      clearAllHighlights();
      highlightStateRef.current.fingerprint = fingerprint ?? null;
      errorKeyRef.current = fingerprint ?? parseResult?.displayText ?? text ?? null;
    }
  }, [parseResult, enabled, fingerprint, editorRef, text, renderRetryTick, scheduleRetry]);

  return highlightStateRef;
}
