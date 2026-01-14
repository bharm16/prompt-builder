import { describe, expect, it } from 'vitest';

import {
  buildSimplifiedSpans,
  findNearbySpans,
  prepareSpanContext,
} from '@features/span-highlighting/utils/spanProcessing';

describe('spanProcessing', () => {
  it('finds nearby spans around selected metadata', () => {
    const metadata = { start: 5, end: 7 };
    const spans = [
      { start: 0, end: 4, text: 'before', category: 'style' },
      { start: 5, end: 7, text: 'target', category: 'style' },
      { start: 8, end: 12, text: 'after', category: 'style' },
    ];

    const nearby = findNearbySpans(metadata, spans, 5);

    expect(nearby).toHaveLength(2);
    expect(nearby[0]?.position).toBe('before');
    expect(nearby[1]?.position).toBe('after');
  });

  it('builds simplified spans from raw input', () => {
    const result = buildSimplifiedSpans([
      { quote: 'hello', category: 'style', role: 'style' },
      { text: '' },
    ]);

    expect(result).toEqual([
      { text: 'hello', role: 'style', category: 'style' },
    ]);
  });

  it('prepares span context with simplified and nearby spans', () => {
    const metadata = { start: 0, end: 2 };
    const spans = [
      { start: 0, end: 2, text: 'hi', category: 'style' },
      { start: 3, end: 5, text: 'there', category: 'style' },
    ];

    const context = prepareSpanContext(metadata, spans);

    expect(context.simplifiedSpans).toHaveLength(2);
    expect(context.nearbySpans).toHaveLength(1);
  });
});
