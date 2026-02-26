/**
 * Span Processing Utilities
 * 
 * Functions for filtering, validating, and sorting spans for highlighting.
 */

import { snapSpanToTokenBoundaries, type Range } from './tokenBoundaries';

export interface SpanWithOffsets {
  displayStart?: number | undefined;
  start: number;
  displayEnd?: number | undefined;
  end: number;
}

export interface ProcessedSpan<T extends SpanWithOffsets = SpanWithOffsets> {
  span: T;
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
export function snapSpan<T extends SpanWithOffsets>(span: T, displayText: string): ProcessedSpan<T> | null {
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
export function processAndSortSpans<T extends SpanWithOffsets>(
  spans: T[],
  displayText: string
): ProcessedSpan<T>[] {
  return [...spans]
    .filter(hasValidOffsets)
    .map((span) => snapSpan(span, displayText))
    .filter((item): item is ProcessedSpan<T> => item !== null)
    .sort((a, b) => b.highlightStart - a.highlightStart); // Reverse order for DOM manipulation
}
