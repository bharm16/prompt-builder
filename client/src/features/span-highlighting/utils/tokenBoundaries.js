/**
 * Token Boundaries Utility
 * Handles word boundary detection and span snapping logic
 */

/**
 * Checks if a position in text is at a word boundary
 * @param {string} text - The text to check
 * @param {number} index - The position to check
 * @returns {boolean} True if at a word boundary
 */
export function isWordBoundary(text, index) {
  if (index <= 0 || index >= text.length) {
    return true;
  }
  const prev = text[index - 1];
  const current = text[index];
  return !(/\w/.test(prev) && /\w/.test(current));
}

/**
 * Snaps a span to token (word) boundaries to avoid splitting words
 * @param {string} text - The full text
 * @param {number} start - The start position
 * @param {number} end - The end position
 * @returns {Object|null} { start: number, end: number } or null if invalid
 */
export function snapSpanToTokenBoundaries(text, start, end) {
  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  let safeStart = Math.max(0, start);
  let safeEnd = Math.min(text.length, end);

  // Move start backward to the nearest word boundary
  while (safeStart > 0 && !isWordBoundary(text, safeStart)) {
    safeStart -= 1;
  }

  // Move end forward to the nearest word boundary
  while (safeEnd < text.length && !isWordBoundary(text, safeEnd)) {
    safeEnd += 1;
  }

  if (safeEnd <= safeStart) {
    return null;
  }

  return { start: safeStart, end: safeEnd };
}

/**
 * Checks if a range overlaps with any existing ranges
 * @param {Array<{start: number, end: number}>} ranges - Existing ranges
 * @param {number} start - Start of new range
 * @param {number} end - End of new range
 * @returns {boolean} True if there's an overlap
 */
export function rangeOverlaps(ranges, start, end) {
  return ranges.some((range) => !(end <= range.start || start >= range.end));
}
