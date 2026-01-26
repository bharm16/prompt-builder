import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSpanLabelingCache } from '@features/span-highlighting/hooks/useSpanLabelingCache';
import type { SpanLabelingCacheService } from '@features/span-highlighting/hooks/useSpanLabelingCache';
import type { SpanLabelingPayload } from '@features/span-highlighting/hooks/types';

describe('useSpanLabelingCache', () => {
  const payload: SpanLabelingPayload = { text: 'hello world', maxSpans: 5 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('returns null cache results when no cache service is available', () => {
      const { result } = renderHook(() => useSpanLabelingCache(null));

      const cacheResult = result.current.checkCache(payload);

      expect(cacheResult.cached).toBeNull();
      expect(cacheResult.cacheCheckDuration).toBeGreaterThanOrEqual(0);
    });

    it('skips cache writes when cache service is missing', () => {
      const { result } = renderHook(() => useSpanLabelingCache(null));

      expect(() =>
        result.current.setCache(payload, { spans: [], meta: null })
      ).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('returns null when the cache has no entry', () => {
      const cacheService: SpanLabelingCacheService = {
        get: vi.fn(() => null),
        set: vi.fn(),
      };

      const { result } = renderHook(() => useSpanLabelingCache(cacheService));

      const cacheResult = result.current.checkCache(payload);

      expect(cacheResult.cached).toBeNull();
      expect(cacheService.get).toHaveBeenCalledWith(payload);
    });
  });

  describe('core behavior', () => {
    it('returns cached spans and metadata when available', () => {
      const cacheService: SpanLabelingCacheService = {
        get: vi.fn(() => ({
          spans: [{ start: 0, end: 2, category: 'style', confidence: 0.8 }],
          meta: { version: 'v1' },
          cacheId: 'cache-1',
          signature: 'sig-1',
          text: 'hello world',
          timestamp: 0,
        })),
        set: vi.fn(),
      };

      const { result } = renderHook(() => useSpanLabelingCache(cacheService));

      const cacheResult = result.current.checkCache(payload);

      expect(cacheResult.cached).toEqual({
        spans: [{ start: 0, end: 2, category: 'style', confidence: 0.8 }],
        meta: { version: 'v1' },
        cacheId: 'cache-1',
        signature: 'sig-1',
      });
    });

    it('writes cache entries through the provided service', () => {
      const cacheService: SpanLabelingCacheService = {
        get: vi.fn(() => null),
        set: vi.fn(),
      };

      const { result } = renderHook(() => useSpanLabelingCache(cacheService));

      result.current.setCache(payload, { spans: [], meta: null, signature: 'sig' });

      expect(cacheService.set).toHaveBeenCalledWith(payload, {
        spans: [],
        meta: null,
        signature: 'sig',
      });
    });
  });
});
