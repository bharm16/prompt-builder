import { describe, expect, it } from 'vitest';

import { isWordBoundary, rangeOverlaps, snapSpanToTokenBoundaries } from '@features/span-highlighting/utils/tokenBoundaries';

describe('tokenBoundaries', () => {
  it('identifies word boundaries', () => {
    expect(isWordBoundary('hello', 0)).toBe(true);
    expect(isWordBoundary('hello', 5)).toBe(true);
    expect(isWordBoundary('hello world', 5)).toBe(true);
    expect(isWordBoundary('hello', 2)).toBe(false);
  });

  it('snaps spans to token boundaries', () => {
    const result = snapSpanToTokenBoundaries('hello world', 1, 8);
    expect(result).toEqual({ start: 0, end: 11 });
  });

  it('detects overlapping ranges', () => {
    const ranges = [{ start: 0, end: 5 }];
    expect(rangeOverlaps(ranges, 4, 6)).toBe(true);
    expect(rangeOverlaps(ranges, 5, 7)).toBe(false);
  });
});
