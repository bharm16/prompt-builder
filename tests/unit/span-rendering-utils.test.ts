import { describe, expect, it } from 'vitest';

import { hasValidOffsets, processAndSortSpans, snapSpan } from '@features/span-highlighting/utils/spanRenderingUtils';

describe('spanRenderingUtils', () => {
  it('validates offsets', () => {
    expect(hasValidOffsets({ start: 0, end: 2 })).toBe(true);
    expect(hasValidOffsets({ start: 5, end: 2 })).toBe(false);
  });

  it('snaps spans to token boundaries', () => {
    const span = { start: 1, end: 4 };
    const result = snapSpan(span, 'hello world');
    expect(result?.highlightStart).toBe(0);
    expect(result?.highlightEnd).toBe(5);
  });

  it('processes and sorts spans in reverse order', () => {
    const spans = [
      { start: 0, end: 2 },
      { start: 6, end: 8 },
    ];
    const result = processAndSortSpans(spans, 'hello world');
    expect(result[0]?.highlightStart).toBe(6);
    expect(result[1]?.highlightStart).toBe(0);
  });
});
