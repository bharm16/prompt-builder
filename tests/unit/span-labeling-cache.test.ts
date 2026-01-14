import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { spanLabelingCache } from '@features/span-highlighting/services/SpanLabelingCache';
import type { SpanLabelingPayload } from '@features/span-highlighting/hooks/types';

const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

describe('SpanLabelingCache', () => {
  beforeEach(() => {
    spanLabelingCache.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves cache entries', () => {
    const payload: SpanLabelingPayload = { text: 'hello', maxSpans: 5 };

    spanLabelingCache.set(payload, {
      spans: [{ start: 0, end: 2, category: 'style', confidence: 0.7 }],
      meta: { source: 'network' },
    });

    const result = spanLabelingCache.get(payload);

    expect(result?.text).toBe('hello');
    expect(result?.spans).toHaveLength(1);
    expect(result?.signature).toBeTruthy();
  });

  it('expires entries older than max age', () => {
    const payload: SpanLabelingPayload = { text: 'hello', maxSpans: 5 };

    spanLabelingCache.set(payload, {
      spans: [{ start: 0, end: 2, category: 'style', confidence: 0.7 }],
      meta: null,
    });

    vi.setSystemTime(new Date(Date.now() + MAX_CACHE_AGE_MS + 1));

    const result = spanLabelingCache.get(payload);

    expect(result).toBeNull();
  });
});
