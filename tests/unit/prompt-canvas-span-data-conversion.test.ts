import { describe, expect, it } from 'vitest';

import {
  convertHighlightSnapshotToSourceSelectionOptions,
  convertHighlightSnapshotToSpanData,
  convertSpansDataToSpanData,
  isValidSpan,
} from '@features/prompt-optimizer/PromptCanvas/utils/spanDataConversion';
import type { HighlightSnapshot, SpansData } from '@features/prompt-optimizer/PromptCanvas/types';

describe('spanDataConversion', () => {
  it('validates spans with required fields', () => {
    expect(isValidSpan({ start: 0, end: 2, category: 'style', confidence: 0.5 })).toBe(true);
    expect(isValidSpan({ start: 0, end: 2, category: 'style' })).toBe(false);
  });

  it('converts SpansData to SpanData and filters invalid spans', () => {
    const spans = {
      spans: [
        { start: 0, end: 2, category: 'style', confidence: 0.5 },
        { start: 0, end: 2, category: 'style' },
      ],
      meta: { source: 'test' },
    } as unknown as SpansData;

    const result = convertSpansDataToSpanData(spans);

    expect(result?.spans).toHaveLength(1);
    expect(result?.meta).toEqual({ source: 'test' });
  });

  it('converts highlight snapshot to span data and source selection options', () => {
    const snapshot: HighlightSnapshot = {
      spans: [
        { start: 0, end: 2, category: 'style', confidence: 0.5 },
      ],
      meta: { source: 'cache' },
      signature: 'sig',
      cacheId: 'cache-1',
    };

    const spanData = convertHighlightSnapshotToSpanData(snapshot);
    expect(spanData?.spans).toHaveLength(1);

    const options = convertHighlightSnapshotToSourceSelectionOptions(snapshot);
    expect(options).toEqual({
      spans: [{ start: 0, end: 2, category: 'style', confidence: 0.5 }],
      meta: { source: 'cache' },
      signature: 'sig',
      cacheId: 'cache-1',
    });
  });
});
