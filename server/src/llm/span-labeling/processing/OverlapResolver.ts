/**
 * Overlap resolution module
 *
 * Resolves overlapping spans by confidence score.
 * Assumes spans are sorted by start position.
 */

import { getParentCategory } from '#shared/taxonomy.ts';

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

  const getParent = (role: unknown): string => {
    if (typeof role !== 'string') return '';
    return getParentCategory(role) || role;
  };

  const getSpecificity = (role: unknown): number => {
    if (typeof role !== 'string') return 0;
    return role.split('.').length;
  };

  const chooseWinner = (a: SpanLike, b: SpanLike): SpanLike => {
    const parentA = getParent(a.role);
    const parentB = getParent(b.role);

    if (parentA && parentB && parentA !== parentB) {
      return b;
    }

    const specificityA = getSpecificity(a.role);
    const specificityB = getSpecificity(b.role);
    if (specificityA !== specificityB) {
      return specificityA > specificityB ? a : b;
    }

    if (a.confidence !== b.confidence) {
      return a.confidence > b.confidence ? a : b;
    }

    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) {
      return lenA > lenB ? a : b;
    }

    return a.start <= b.start ? a : b;
  };

  sortedSpans.forEach((span) => {
    if (resolved.length === 0) {
      resolved.push(span);
      return;
    }

    const spanParent = getParent(span.role);
    const overlapping = resolved
      .map((existing, index) => ({ existing, index }))
      .filter(({ existing }) => {
        const existingParent = getParent(existing.role);
        if (spanParent && existingParent && spanParent !== existingParent) {
          return false;
        }
        return span.start < existing.end && existing.start < span.end;
      });

    if (overlapping.length === 0) {
      resolved.push(span);
      return;
    }

    let winner = span;
    overlapping.forEach(({ existing }) => {
      winner = chooseWinner(winner, existing);
    });

    if (winner === span) {
      overlapping
        .sort((a, b) => b.index - a.index)
        .forEach(({ index, existing }) => {
          notes.push(
            `Overlap between "${existing.text}" ` +
            `(${existing.start}-${existing.end}, conf=${existing.confidence.toFixed(2)}) ` +
            `and "${span.text}" ` +
            `(${span.start}-${span.end}, conf=${span.confidence.toFixed(2)}); ` +
            `kept "${span.text}".`
          );
          resolved.splice(index, 1);
        });
      resolved.push(span);
    } else {
      notes.push(
        `Overlap between "${span.text}" ` +
        `(${span.start}-${span.end}, conf=${span.confidence.toFixed(2)}) ` +
        `and "${winner.text}" ` +
        `(${winner.start}-${winner.end}, conf=${winner.confidence.toFixed(2)}); ` +
        `kept "${winner.text}".`
      );
    }
  });

  return { spans: resolved, notes };
}
