import { buildSpanKey } from '../utils/textUtils.js';

/**
 * Span deduplication module
 *
 * Removes duplicate spans based on position and text.
 * LLMs sometimes generate duplicate spans, especially after repairs.
 */

interface SpanLike {
  start: number;
  end: number;
  text: string;
  [key: string]: unknown;
}

interface DedupeResult {
  spans: SpanLike[];
  notes: string[];
}

/**
 * Deduplicate spans based on position and text
 *
 * Uses a Set to track unique (start, end, text) combinations.
 * Keeps the first occurrence of each unique span.
 *
 * @param {Array<Object>} spans - Sorted array of spans
 * @returns {Object} {spans: Array, notes: Array}
 */
export function deduplicateSpans(spans: SpanLike[]): DedupeResult {
  const seenKeys = new Set<string>();
  const deduplicated: SpanLike[] = [];
  const notes: string[] = [];

  spans.forEach((span, index) => {
    const key = buildSpanKey(span);
    if (seenKeys.has(key)) {
      notes.push(`span[${index}] ignored: duplicate span`);
    } else {
      seenKeys.add(key);
      deduplicated.push(span);
    }
  });

  return { spans: deduplicated, notes };
}
