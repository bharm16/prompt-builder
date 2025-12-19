/**
 * Span Processing Utilities
 * 
 * Functions for filtering, validating, and sorting spans for highlighting.
 */

import { snapSpanToTokenBoundaries, type Range } from './tokenBoundaries';

export interface SpanWithOffsets {
  displayStart?: number;
  start: number;
  displayEnd?: number;
  end: number;
  [key: string]: unknown;
}

export interface ProcessedSpan {
  span: SpanWithOffsets;
  highlightStart: number;
  highlightEnd: number;
}

/**
 * Check if a span has valid numeric offsets
 */
export function hasValidOffsets(span: SpanWithOffsets): boolean {
  const start = Number(span.displayStart ?? span.start);
  const end = Number(span.displayEnd ?? span.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

/**
 * Snap a span to token boundaries
 */
export function snapSpan(span: SpanWithOffsets, displayText: string): ProcessedSpan | null {
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
 */
export function processAndSortSpans(
  spans: SpanWithOffsets[],
  displayText: string
): ProcessedSpan[] {
  return [...spans]
    .filter(hasValidOffsets)
    .map((span) => snapSpan(span, displayText))
    .filter((item): item is ProcessedSpan => item !== null)
    .sort((a, b) => b.highlightStart - a.highlightStart); // Reverse order for DOM manipulation
}

