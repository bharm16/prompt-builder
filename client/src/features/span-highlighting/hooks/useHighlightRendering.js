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

import { useEffect, useRef } from 'react';
import { PromptContext } from '../../../utils/PromptContext';
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
} from '../utils/index.js';
import { PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from '../config/index.js';

/**
 * Custom hook for rendering highlights in the editor
 *
 * @param {Object} params
 * @param {React.RefObject} params.editorRef - Reference to the editor element
 * @param {Object} params.parseResult - Parsed result containing spans to highlight
 * @param {boolean} params.enabled - Whether highlighting is enabled
 * @param {string} params.fingerprint - Unique fingerprint for current highlight state
 * @param {string} params.text - Text content to highlight (passed as prop to avoid DOM reads)
 * @returns {React.RefObject} Reference to highlight state
 */
export function useHighlightRendering({
  editorRef,
  parseResult,
  enabled,
  fingerprint,
  text,
}) {
  const highlightStateRef = useRef({
    spanMap: new Map(), // Maps span.id -> { span, wrappers: [] }
    nodeIndex: null,
    fingerprint: null,
  });

  /**
   * Helper: Check if a span has changed (position or text)
   */
  const hasSpanChanged = (existingSpan, newSpan) => {
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
  const clearAllHighlights = () => {
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

  // Main highlighting effect - DIFF-BASED RENDERING
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    // Handle disabled state
    if (!enabled) {
      if (highlightStateRef.current.spanMap.size > 0) {
        clearAllHighlights();
      } else {
        highlightStateRef.current.fingerprint = null;
      }
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
      return;
    }

    // ⏱️ PERFORMANCE TIMER: Highlight rendering starts
    const highlightRenderStart = performance.now();

    // Get current state
    const { spanMap } = highlightStateRef.current;
    
    // Process and sort incoming spans
    const sortedSpans = processAndSortSpans(spans, displayText);
    
    // Create a set of new span IDs
    const newSpanIds = new Set();
    const newSpansBySpanId = new Map();
    
    sortedSpans.forEach(({ span }) => {
      // Use span.id if available (from backend), or fall back to composite key
      const spanId = span.id || `${span.start}-${span.end}-${span.category || span.role}`;
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
    const coverage = [];
    let nodeIndex = buildTextNodeIndex(root);

    sortedSpans.forEach(({ span, highlightStart, highlightEnd }) => {
      const spanId = span.id || `${span.start}-${span.end}-${span.category || span.role}`;
      const existingEntry = spanMap.get(spanId);

      // Skip overlapping spans
      if (hasOverlap(coverage, highlightStart, highlightEnd)) {
        return;
      }

      // Extract and validate text
      const expectedText = span.displayQuote ?? span.quote ?? '';
      const actualSlice = displayText.slice(highlightStart, highlightEnd);

      if (!validateHighlightText(expectedText, actualSlice, span, highlightStart, highlightEnd)) {
        return;
      }

      // Determine if we need to render/re-render
      let shouldRender = false;
      
      if (!existingEntry) {
        // New span - needs rendering
        shouldRender = true;
      } else if (hasSpanChanged(existingEntry.span, span)) {
        // Span changed - unwrap old, render new
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
          createWrapper: () => createHighlightWrapper(root, span, highlightStart, highlightEnd, PromptContext.getCategoryColor),
        });

        // Handle empty wrappers
        if (!segmentWrappers.length) {
          logEmptyWrappers(span, highlightStart, highlightEnd, nodeIndex, root);
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

        // Rebuild node index after DOM changes
        nodeIndex = buildTextNodeIndex(root);
      }

      // Track coverage
      addToCoverage(coverage, highlightStart, highlightEnd);
    });

    // Update fingerprint
    highlightStateRef.current.fingerprint = fingerprint ?? null;

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
  }, [parseResult, enabled, fingerprint, editorRef, text]);

  return highlightStateRef;
}

