/**
 * useHighlightRendering Hook
 * 
 * Manages DOM manipulation for applying highlight spans in the editor.
 * Refactored to separate concerns and extract pure functions.
 */

import { useEffect, useRef } from 'react';
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
 * @returns {React.RefObject} Reference to highlight state
 */
export function useHighlightRendering({
  editorRef,
  parseResult,
  enabled,
  fingerprint,
}) {
  const highlightStateRef = useRef({
    wrappers: [],
    nodeIndex: null,
    fingerprint: null,
  });

  /**
   * Clears all existing highlights
   */
  const clearHighlights = () => {
    const { wrappers } = highlightStateRef.current;
    if (wrappers?.length) {
      wrappers.forEach((wrapper) => unwrapHighlight(wrapper));
    }
    highlightStateRef.current = { wrappers: [], nodeIndex: null, fingerprint: null };
  };

  // Clean up on unmount
  useEffect(() => () => clearHighlights(), []);

  // Main highlighting effect
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    // Handle disabled state
    if (!enabled) {
      if (highlightStateRef.current.wrappers.length) {
        clearHighlights();
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
      if (highlightStateRef.current.wrappers.length) {
        clearHighlights();
      }
      highlightStateRef.current.fingerprint = fingerprint ?? null;
      return;
    }

    // Skip if fingerprint unchanged
    if (fingerprint && previousFingerprint === fingerprint) {
      return;
    }

    // Validate display text
    const displayText = parseResult?.displayText ?? root.textContent ?? '';
    if (!displayText) {
      if (highlightStateRef.current.wrappers.length) {
        clearHighlights();
      }
      highlightStateRef.current.fingerprint = fingerprint ?? null;
      return;
    }

    // ⏱️ PERFORMANCE TIMER: Highlight rendering starts
    const highlightRenderStart = performance.now();

    // Clear existing highlights
    clearHighlights();

    // Initialize tracking
    const wrappers = [];
    const coverage = [];
    let nodeIndex = buildTextNodeIndex(root);

    // Process and sort spans
    const sortedSpans = processAndSortSpans(spans, displayText);

    // Apply highlights to each span
    sortedSpans.forEach(({ span, highlightStart, highlightEnd }) => {
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

      // Create wrapper elements
      const segmentWrappers = wrapRangeSegments({
        root,
        start: highlightStart,
        end: highlightEnd,
        nodeIndex,
        createWrapper: () => createHighlightWrapper(root, span, highlightStart, highlightEnd),
      });

      // Handle empty wrappers
      if (!segmentWrappers.length) {
        logEmptyWrappers(span, highlightStart, highlightEnd, nodeIndex, root);
        return;
      }

      // Enhance wrappers with metadata
      segmentWrappers.forEach((wrapper) => {
        enhanceWrapperWithMetadata(wrapper, span);
        wrappers.push(wrapper);
      });

      // Track coverage and rebuild index
      addToCoverage(coverage, highlightStart, highlightEnd);
      nodeIndex = buildTextNodeIndex(root);
    });

    // Update state
    highlightStateRef.current = { 
      wrappers, 
      nodeIndex: null, 
      fingerprint: fingerprint ?? null,
    };

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
  }, [parseResult, enabled, fingerprint, editorRef]);

  return highlightStateRef;
}

