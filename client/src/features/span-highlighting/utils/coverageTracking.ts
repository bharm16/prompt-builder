/**
 * Coverage Tracking Utilities
 * 
 * Functions for tracking which text ranges have been highlighted to prevent overlaps.
 */

import { rangeOverlaps, type Range } from './tokenBoundaries';

/**
 * Check if a range overlaps with any ranges in the coverage array
 */
export function hasOverlap(
  coverage: Range[],
  start: number,
  end: number
): boolean {
  return rangeOverlaps(coverage, start, end);
}

/**
 * Add a range to the coverage array
 */
export function addToCoverage(
  coverage: Range[],
  start: number,
  end: number
): void {
  coverage.push({ start, end });
}

