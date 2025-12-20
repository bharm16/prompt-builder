/**
 * Span Data Conversion Utilities
 * 
 * Pure functions for converting between different span data formats.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import type { SpanData } from '@features/span-highlighting/hooks/useHighlightSourceSelection';
import type { SpansData, HighlightSnapshot, ValidSpan } from '../types';

/**
 * Type guard to check if an unknown value is a valid span
 */
export function isValidSpan(span: unknown): span is ValidSpan {
  return (
    typeof span === 'object' &&
    span !== null &&
    typeof (span as { start?: unknown }).start === 'number' &&
    typeof (span as { end?: unknown }).end === 'number' &&
    typeof (span as { category?: unknown }).category === 'string' &&
    typeof (span as { confidence?: unknown }).confidence === 'number'
  );
}

/**
 * Converts SpansData format to SpanData format
 */
export function convertSpansDataToSpanData(spans: SpansData | null): SpanData | null {
  if (!spans) {
    return null;
  }

  return {
    spans: Array.isArray(spans.spans)
      ? spans.spans.filter(isValidSpan)
      : [],
    meta: spans.meta,
  };
}

/**
 * Converts HighlightSnapshot format to SpanData format
 */
export function convertHighlightSnapshotToSpanData(
  highlights: HighlightSnapshot | null
): SpanData | null {
  if (!highlights) {
    return null;
  }

  return {
    spans: Array.isArray(highlights.spans)
      ? highlights.spans.filter(isValidSpan)
      : [],
    meta: highlights.meta ?? null,
  };
}

/**
 * Converts HighlightSnapshot to UseHighlightSourceSelectionOptions format
 */
export function convertHighlightSnapshotToSourceSelectionOptions(
  highlights: HighlightSnapshot | null
): {
  spans: ValidSpan[];
  meta?: Record<string, unknown> | null;
  signature?: string;
  cacheId?: string | null;
} | null {
  if (!highlights) {
    return null;
  }

  const result: {
    spans: ValidSpan[];
    meta?: Record<string, unknown> | null;
    signature?: string;
    cacheId?: string | null;
  } = {
    spans: Array.isArray(highlights.spans)
      ? highlights.spans.filter(isValidSpan)
      : [],
  };

  if (highlights.meta !== undefined) {
    result.meta = highlights.meta;
  }
  if (highlights.signature !== undefined) {
    result.signature = highlights.signature;
  }
  if (highlights.cacheId !== undefined) {
    result.cacheId = highlights.cacheId ?? null;
  }

  return result;
}

