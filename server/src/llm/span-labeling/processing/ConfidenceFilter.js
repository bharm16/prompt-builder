/**
 * Confidence filtering module
 *
 * Filters spans below minimum confidence threshold.
 * Provides detailed logging of dropped spans.
 */

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
export function filterByConfidence(spans, minConfidence) {
  const notes = [];
  const filtered = spans.filter((span) => {
    if (span.confidence >= minConfidence) return true;

    notes.push(
      `Dropped "${span.text}" at ${span.start}-${span.end} ` +
      `(confidence ${span.confidence.toFixed(2)} below threshold ${minConfidence}).`
    );
    return false;
  });

  return { spans: filtered, notes };
}
