import { buildSpanKey } from '../utils/textUtils.js';

/**
 * Span deduplication module
 *
 * Removes duplicate spans based on position and text.
 * LLMs sometimes generate duplicate spans, especially after repairs.
 */

/**
 * Deduplicate spans based on position and text
 *
 * Uses a Set to track unique (start, end, text) combinations.
 * Keeps the first occurrence of each unique span.
 *
 * @param {Array<Object>} spans - Sorted array of spans
 * @returns {Object} {spans: Array, notes: Array}
 */
export function deduplicateSpans(spans) {
  const seenKeys = new Set();
  const deduplicated = [];
  const notes = [];

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
