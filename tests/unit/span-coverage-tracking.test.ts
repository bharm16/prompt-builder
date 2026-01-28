import { describe, expect, it } from 'vitest';

import { addToCoverage, hasOverlap } from '@features/span-highlighting/utils/coverageTracking';

describe('coverageTracking', () => {
  it('adds ranges and detects overlaps', () => {
    const coverage = [] as Array<{ start: number; end: number }>;

    addToCoverage(coverage, 0, 5);

    expect(hasOverlap(coverage, 4, 6)).toBe(true);
    expect(hasOverlap(coverage, 5, 7)).toBe(false);
  });
});
