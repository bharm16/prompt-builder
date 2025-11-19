/**
 * Coverage Tracking Utilities
 * 
 * Functions for tracking which text ranges have been highlighted to prevent overlaps.
 */

import { rangeOverlaps } from './tokenBoundaries.js';

/**
 * Check if a range overlaps with any ranges in the coverage array
 * 
 * @param {Array} coverage - Array of {start, end} objects representing covered ranges
 * @param {number} start - Start offset to check
 * @param {number} end - End offset to check
 * @returns {boolean} True if range overlaps with existing coverage
 */
export function hasOverlap(coverage, start, end) {
  return rangeOverlaps(coverage, start, end);
}

/**
 * Add a range to the coverage array
 * 
 * @param {Array} coverage - Array of {start, end} objects
 * @param {number} start - Start offset
 * @param {number} end - End offset
 */
export function addToCoverage(coverage, start, end) {
  coverage.push({ start, end });
}

