/**
 * Token Boundaries Utility
 * Handles word boundary detection and span snapping logic
 */

export interface Range {
  start: number;
  end: number;
}

/**
 * Checks if a position in text is at a word boundary
 */
export function isWordBoundary(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) {
    return true;
  }
  const prev = text[index - 1];
  const current = text[index];
  return !(/\w/.test(prev) && /\w/.test(current));
}

/**
 * Snaps a span to token (word) boundaries to avoid splitting words
 */
export function snapSpanToTokenBoundaries(
  text: string,
  start: number,
  end: number
): Range | null {
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
 */
export function rangeOverlaps(ranges: Range[], start: number, end: number): boolean {
  return ranges.some((range) => {
    if (range.end <= range.start) return false;
    return !(end <= range.start || start >= range.end);
  });
}
