import { useCallback } from 'react';
import type { SpanLabelingPayload, LabeledSpan, SpanMeta } from './types.ts';

export interface SpanLabelingCacheService {
  get(payload: SpanLabelingPayload): {
    spans: LabeledSpan[];
    meta: SpanMeta | null;
    cacheId: string | null;
    signature: string;
    timestamp?: number;
  } | null;
  set(
    payload: SpanLabelingPayload,
    data: { spans: LabeledSpan[]; meta: SpanMeta | null; signature?: string }
  ): void;
}

export interface CacheCheckResult {
  cached: {
    spans: LabeledSpan[];
    meta: SpanMeta | null;
    cacheId: string | null;
    signature: string;
  } | null;
  cacheCheckDuration: number;
}

/**
 * Span Labeling Cache Hook
 *
 * Handles cache checking and setting for span labeling.
 * Accepts cache service via dependency injection (not singleton).
 */
export function useSpanLabelingCache(cacheService: SpanLabelingCacheService | null) {
  const checkCacheForPayload = useCallback(
    (payload: SpanLabelingPayload): CacheCheckResult => {
      const cacheCheckStart = performance.now();
      
      if (!cacheService) {
        return { cached: null, cacheCheckDuration: performance.now() - cacheCheckStart };
      }

      const cacheResult = cacheService.get(payload);
      const cacheCheckDuration = performance.now() - cacheCheckStart;
      
      if (cacheResult) {
        return {
          cached: {
            spans: cacheResult.spans,
            meta: cacheResult.meta,
            cacheId: cacheResult.cacheId,
            signature: cacheResult.signature,
          },
          cacheCheckDuration,
        };
      }

      return { cached: null, cacheCheckDuration };
    },
    [cacheService]
  );

  const setCacheForPayload = useCallback(
    (
      payload: SpanLabelingPayload,
      data: { spans: LabeledSpan[]; meta: SpanMeta | null; signature?: string }
    ): void => {
      if (!cacheService) {
        return;
      }
      cacheService.set(payload, data);
    },
    [cacheService]
  );

  return {
    checkCache: checkCacheForPayload,
    setCache: setCacheForPayload,
  };
}

