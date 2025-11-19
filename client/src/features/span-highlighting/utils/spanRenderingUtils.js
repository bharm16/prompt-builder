/**
 * Span Processing Utilities
 * 
 * Functions for filtering, validating, and sorting spans for highlighting.
 */

import { snapSpanToTokenBoundaries } from './tokenBoundaries.js';

/**
 * Check if a span has valid numeric offsets
 */
export function hasValidOffsets(span) {
  const start = Number(span.displayStart ?? span.start);
  const end = Number(span.displayEnd ?? span.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

/**
 * Snap a span to token boundaries
 */
export function snapSpan(span, displayText) {
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
}

/**
 * Process and sort spans for highlighting
 * 
 * @param {Array} spans - Array of span objects
 * @param {string} displayText - The text being highlighted
 * @returns {Array} Sorted array of processed spans
 */
export function processAndSortSpans(spans, displayText) {
  return [...spans]
    .filter(hasValidOffsets)
    .map((span) => snapSpan(span, displayText))
    .filter(Boolean)
    .sort((a, b) => b.highlightStart - a.highlightStart); // Reverse order for DOM manipulation
}

