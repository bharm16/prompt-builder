import { buildSpanKey } from '../utils/textUtils.js';

interface SpanLike {
  text: string;
  start: number;
  end: number;
  confidence: number;
  [key: string]: unknown;
}

interface TruncateResult {
  spans: SpanLike[];
  notes: string[];
}

/**
 * Span truncation module
 *
 * Limits spans to maximum count, keeping highest confidence spans.
 * Preserves positional ordering in the final output.
 */

/**
 * Truncate spans to maximum count, keeping highest confidence spans
 *
 * Strategy:
 * 1. Rank spans by confidence (highest first)
 * 2. Select top N spans by confidence
 * 3. Re-sort selected spans by position for output
 *
 * @param {Array<Object>} spans - Spans to truncate
 * @param {number} maxSpans - Maximum number of spans to keep
 * @returns {Object} {spans: Array, notes: Array}
 */
export function truncateToMaxSpans(
  spans: SpanLike[],
  maxSpans: number
): TruncateResult {
  if (spans.length <= maxSpans) {
    return { spans, notes: [] };
  }

  // Rank by confidence, break ties by position
  const ranked = [...spans].sort((a, b) => {
    if (b.confidence === a.confidence) return a.start - b.start;
    return b.confidence - a.confidence;
  });

  // Select top maxSpans spans
  const keepSet = new Set<string>(ranked.slice(0, maxSpans).map(buildSpanKey));
  const truncated = spans.filter((span) => keepSet.has(buildSpanKey(span)));

  // Re-sort by position for output consistency
  truncated.sort((a, b) => {
    if (a.start === b.start) return a.end - b.end;
    return a.start - b.start;
  });

  const notes = [
    `Truncated spans to maxSpans=${maxSpans}; removed ${spans.length - truncated.length} spans.`,
  ];

  return { spans: truncated, notes };
}
