import { describe, expect, it, vi, type MockedFunction } from 'vitest';

import { createResultEmitter } from '@features/span-highlighting/utils/spanLabelingResultEmitter';
import type { SpanLabelingResult } from '@features/span-highlighting/hooks/types';

describe('spanLabelingResultEmitter', () => {
  it('emits results once per signature and source', () => {
    const onResult: MockedFunction<(result: SpanLabelingResult) => void> = vi.fn();
    const emit = createResultEmitter(onResult);

    emit(
      {
        spans: [{ start: 0, end: 1, category: 'style', confidence: 0.9 }],
        meta: null,
        text: 'hello',
        signature: 'sig',
        cacheId: null,
      },
      'network'
    );

    emit(
      {
        spans: [{ start: 0, end: 1, category: 'style', confidence: 0.9 }],
        meta: null,
        text: 'hello',
        signature: 'sig',
        cacheId: null,
      },
      'network'
    );

    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('skips emit when spans are empty', () => {
    const onResult: MockedFunction<(result: SpanLabelingResult) => void> = vi.fn();
    const emit = createResultEmitter(onResult);

    emit({ spans: [], meta: null, text: 'hello' }, 'network');

    expect(onResult).not.toHaveBeenCalled();
  });
});
