/**
 * Overlap resolution module
 *
 * Resolves overlapping spans by confidence score.
 * Assumes spans are sorted by start position.
 */

interface SpanLike {
  text: string;
  start: number;
  end: number;
  confidence: number;
  [key: string]: unknown;
}

interface ResolveResult {
  spans: SpanLike[];
  notes: string[];
}

/**
 * Resolve overlapping spans by keeping the higher confidence span
 *
 * Strategy:
 * - Iterate through sorted spans
 * - Compare each span with the last kept span
 * - If overlap detected, keep the higher confidence span
 * - Generate detailed notes for debugging
 *
 * @param {Array<Object>} sortedSpans - Spans sorted by start position
 * @param {boolean} allowOverlap - If true, keeps all spans without resolution
 * @returns {Object} {spans: Array, notes: Array}
 */
export function resolveOverlaps(
  sortedSpans: SpanLike[],
  allowOverlap: boolean
): ResolveResult {
  // Skip resolution if overlaps are allowed
  if (allowOverlap) {
    return { spans: sortedSpans, notes: [] };
  }

  const resolved: SpanLike[] = [];
  const notes: string[] = [];

  sortedSpans.forEach((span) => {
    const last = resolved[resolved.length - 1];

    // No overlap - add span
    if (!last || span.start >= last.end) {
      resolved.push(span);
      return;
    }

    // Overlap detected - keep higher confidence span
    const winner = span.confidence > last.confidence ? span : last;
    const loser = winner === span ? last : span;

    notes.push(
      `Overlap between "${last.text}" ` +
      `(${last.start}-${last.end}, conf=${last.confidence.toFixed(2)}) ` +
      `and "${span.text}" ` +
      `(${span.start}-${span.end}, conf=${span.confidence.toFixed(2)}); ` +
      `kept "${winner.text}".`
    );

    // Replace last span if current span wins
    if (winner === span) {
      resolved[resolved.length - 1] = span;
    }
    // Otherwise, keep the last span (do nothing)
  });

  return { spans: resolved, notes };
}
