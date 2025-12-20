/**
 * Confidence filtering module
 *
 * Filters spans below minimum confidence threshold.
 * Provides detailed logging of dropped spans.
 */
import type { SpanLike } from '../types.js';

interface FilterResult {
  spans: SpanLike[];
  notes: string[];
}

/**
 * Filter spans by minimum confidence threshold
 *
 * Removes spans that don't meet the minimum confidence requirement.
 * Generates notes for each dropped span for debugging.
 *
 * @param {Array<Object>} spans - Spans to filter
 * @param {number} minConfidence - Minimum confidence threshold (0-1)
 * @returns {Object} {spans: Array, notes: Array}
 */
export function filterByConfidence(
  spans: SpanLike[],
  minConfidence: number
): FilterResult {
  const notes: string[] = [];
  const filtered = spans.filter((span) => {
    const confidence = typeof span.confidence === 'number' ? span.confidence : 0;
    if (confidence >= minConfidence) return true;

    notes.push(
      `Dropped "${span.text}" at ${span.start}-${span.end} ` +
      `(confidence ${confidence.toFixed(2)} below threshold ${minConfidence}).`
    );
    return false;
  });

  return { spans: filtered, notes };
}
