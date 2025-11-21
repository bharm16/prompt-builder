import { useEffect, useRef, useMemo } from 'react';
import { buildTextNodeIndex, wrapRangeSegments } from '../../../utils/anchorRanges.js';
import { snapSpanToTokenBoundaries, rangeOverlaps } from '../utils/tokenBoundaries.js';
import { createHighlightSignature } from './useSpanLabeling.js';
import { PromptContext } from '../../../utils/PromptContext';

// Debug flag for highlight logging
const DEBUG_HIGHLIGHTS = true;

/**
 * Custom hook for rendering highlights in the editor
 * Manages DOM manipulation for applying highlight spans
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
   * Unwraps a highlighted element, restoring original text nodes
   */
  const unwrapHighlight = (element) => {
    if (!element || !element.parentNode) return;
    const parent = element.parentNode;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  };

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

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    if (!enabled) {
      if (highlightStateRef.current.wrappers.length) {
        clearHighlights();
      } else {
        highlightStateRef.current.fingerprint = null;
      }
      return;
    }

    const spans = Array.isArray(parseResult?.spans) ? parseResult.spans : [];
    const previousFingerprint = highlightStateRef.current.fingerprint;

    if (!spans.length) {
      if (highlightStateRef.current.wrappers.length) {
        clearHighlights();
      }
      highlightStateRef.current.fingerprint = fingerprint ?? null;
      return;
    }

    if (fingerprint && previousFingerprint === fingerprint) {
      return;
    }

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

    clearHighlights();

    const wrappers = [];
    const coverage = [];

    let nodeIndex = buildTextNodeIndex(root);

    const sortedSpans = [...spans]
      .filter((span) => {
        const start = Number(span.displayStart ?? span.start);
        const end = Number(span.displayEnd ?? span.end);
        return Number.isFinite(start) && Number.isFinite(end) && end > start;
      })
      .map((span) => {
        const start = Number(span.displayStart ?? span.start);
        const end = Number(span.displayEnd ?? span.end);
        const snapped = snapSpanToTokenBoundaries(displayText, start, end);
        return snapped
          ? {
              span,
              highlightStart: snapped.start,
              highlightEnd: snapped.end,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.highlightStart - a.highlightStart);

    sortedSpans.forEach(({ span, highlightStart, highlightEnd }) => {
      if (rangeOverlaps(coverage, highlightStart, highlightEnd)) {
        return;
      }

      const expectedText = span.displayQuote ?? span.quote ?? '';
      const actualSlice = displayText.slice(highlightStart, highlightEnd);

      // RELAXED VALIDATION: Use fuzzy matching to handle whitespace/case differences
      // This prevents filtering out valid highlights due to minor text variations
      if (expectedText && actualSlice) {
        // Normalize both strings (lowercase, trim, collapse whitespace)
        const normalizedExpected = expectedText.toLowerCase().trim().replace(/\s+/g, ' ');
        const normalizedActual = actualSlice.toLowerCase().trim().replace(/\s+/g, ' ');

        // Only skip if there's a significant mismatch
        if (normalizedExpected !== normalizedActual) {
          // Allow substring matches (e.g., "Close-up" in "Close-up of")
          const isSubstringMatch =
            normalizedActual.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedActual);

          if (!isSubstringMatch) {
            if (DEBUG_HIGHLIGHTS) {
              console.warn('[HIGHLIGHT] SPAN_MISMATCH - Skipping highlight', {
                id: span.id,
                role: span.role,
                expected: expectedText,
                found: actualSlice,
                normalizedExpected,
                normalizedActual,
                start: highlightStart,
                end: highlightEnd,
              });
            }
            return;
          }
        }
      } else if (!actualSlice || !actualSlice.trim()) {
        // Skip empty slices
        return;
      }

      const segmentWrappers = wrapRangeSegments({
        root,
        start: highlightStart,
        end: highlightEnd,
        nodeIndex,
        createWrapper: () => {
          const el = root.ownerDocument.createElement('span');
          el.className = `value-word value-word-${span.category}`;
          el.dataset.category = span.category;
          el.dataset.source = span.source;
          el.dataset.spanId = span.id;
          el.dataset.start = String(span.start);
          el.dataset.end = String(span.end);
          el.dataset.startDisplay = String(highlightStart);
          el.dataset.endDisplay = String(highlightEnd);
          el.dataset.startGrapheme = String(span.startGrapheme ?? '');
          el.dataset.endGrapheme = String(span.endGrapheme ?? '');
          el.dataset.validatorPass = span.validatorPass === false ? 'false' : 'true';
          el.dataset.idempotencyKey = span.idempotencyKey ?? '';
          const color = PromptContext.getCategoryColor?.(span.category);
          if (color) {
            el.style.backgroundColor = color.bg;
            el.style.borderBottom = `2px solid ${color.border}`;
            el.style.padding = '1px 3px';
            el.style.borderRadius = '3px';
          }
          return el;
        },
      });

      if (!segmentWrappers.length) {
        if (DEBUG_HIGHLIGHTS) {
          console.warn('[HIGHLIGHT] wrapRangeSegments returned 0 wrappers for:', {
            text: expectedText,
            role: span.role,
            start: highlightStart,
            end: highlightEnd,
            nodeIndexLength: nodeIndex.nodes?.length,
            rootTextContentLength: root.textContent?.length
          });
        }
        return;
      }

      segmentWrappers.forEach((wrapper) => {
        wrapper.dataset.quote = span.quote ?? '';
        wrapper.dataset.leftCtx = span.leftCtx ?? '';
        wrapper.dataset.rightCtx = span.rightCtx ?? '';
        wrapper.dataset.displayQuote = span.displayQuote ?? span.quote ?? '';
        wrapper.dataset.displayLeftCtx = span.displayLeftCtx ?? '';
        wrapper.dataset.displayRightCtx = span.displayRightCtx ?? '';
        wrapper.dataset.source = span.source ?? '';
        if (typeof span.confidence === 'number') {
          wrapper.dataset.confidence = String(span.confidence);
        }
        wrappers.push(wrapper);
      });

      coverage.push({ start: highlightStart, end: highlightEnd });
      nodeIndex = buildTextNodeIndex(root);
    });

    highlightStateRef.current = { wrappers, nodeIndex: null, fingerprint: fingerprint ?? null };

    // ⏱️ CRITICAL PERFORMANCE TIMER: Highlights are now visible on screen!
    const highlightRenderEnd = performance.now();

    performance.mark('highlights-visible-on-screen');

    // Measure from prompt displayed to highlights visible (THE CRITICAL 290ms METRIC)
    try {
      performance.measure('CRITICAL-prompt-to-highlights', 'prompt-displayed-on-screen', 'highlights-visible-on-screen');
    } catch (err) {
      // Mark may not exist if prompt wasn't displayed yet (e.g., page load with no content)
    }
  }, [parseResult, enabled, fingerprint]);

  return highlightStateRef;
}

/**
 * Creates a unique fingerprint for the current highlight state
 * Used to determine if highlights need to be re-rendered
 *
 * @param {boolean} enabled - Whether highlighting is enabled
 * @param {Object} parseResult - Parse result containing text and spans
 * @returns {string|null} Fingerprint string or null if disabled
 */
export function useHighlightFingerprint(enabled, parseResult) {
  return useMemo(() => {
    if (!enabled) {
      return null;
    }

    const text = parseResult?.displayText ?? '';
    const spans = Array.isArray(parseResult?.spans) ? parseResult.spans : [];
    const textSignature = createHighlightSignature(text ?? '');

    if (!spans.length) {
      return `empty::${textSignature}`;
    }

    const spanSignature = spans
      .map((span) =>
        [span.id ?? '', span.displayStart ?? span.start, span.displayEnd ?? span.end, span.category ?? ''].join(':')
      )
      .join('|');

    return `${textSignature}::${spanSignature}`;
  }, [enabled, parseResult?.displayText, parseResult?.spans]);
}
