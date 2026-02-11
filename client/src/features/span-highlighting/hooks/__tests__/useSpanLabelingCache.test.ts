import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSpanLabelingCache } from '../useSpanLabelingCache';

describe('useSpanLabelingCache', () => {
  const payload = {
    text: 'Hero runs through neon rain',
    cacheId: 'prompt-1',
    maxSpans: 20,
  };

  it('returns cached data and forwards set operations when cache service exists', () => {
    const get = vi.fn().mockReturnValue({
      spans: [{ start: 0, end: 4, category: 'subject', confidence: 0.9 }],
      meta: { source: 'cache' },
      cacheId: 'prompt-1',
      signature: 'sig-1',
      text: payload.text,
    });
    const set = vi.fn();

    const { result } = renderHook(() => useSpanLabelingCache({ get, set }));

    const cacheResult = result.current.checkCache(payload);

    expect(get).toHaveBeenCalledWith(payload);
    expect(cacheResult.cached).toEqual({
      spans: [{ start: 0, end: 4, category: 'subject', confidence: 0.9 }],
      meta: { source: 'cache' },
      cacheId: 'prompt-1',
      signature: 'sig-1',
    });
    expect(cacheResult.cacheCheckDuration).toBeGreaterThanOrEqual(0);

    act(() => {
      result.current.setCache(payload, {
        spans: [{ start: 5, end: 9, category: 'action', confidence: 0.8 }],
        meta: { source: 'network' },
      });
    });

    expect(set).toHaveBeenCalledWith(payload, {
      spans: [{ start: 5, end: 9, category: 'action', confidence: 0.8 }],
      meta: { source: 'network' },
    });
  });

  it('returns null cache and no-ops set when cache service is absent', () => {
    const { result } = renderHook(() => useSpanLabelingCache(null));

    const cacheResult = result.current.checkCache(payload);

    expect(cacheResult.cached).toBeNull();
    expect(cacheResult.cacheCheckDuration).toBeGreaterThanOrEqual(0);

    expect(() => {
      result.current.setCache(payload, {
        spans: [],
        meta: null,
      });
    }).not.toThrow();
  });
});
