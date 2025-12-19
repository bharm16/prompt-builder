/**
 * Span Labeling Scheduler Utilities
 *
 * Handles scheduling, debouncing, and cache checking for span labeling requests.
 */

import { spanLabelingCache } from '../services/index.ts';
import { calculateSmartDebounce } from '../config/index.ts';
import type {
  SpanLabelingPayload,
  SpanLabelingState,
  LabeledSpan,
  SpanMeta,
} from '../hooks/types.ts';

export interface SchedulerOptions {
  enabled: boolean;
  debounceMs: number;
  useSmartDebounce: boolean;
  immediate: boolean;
}

export interface CacheCheckResult {
  cached: {
    spans: unknown[];
    meta: unknown | null;
    cacheId?: string | null;
    signature: string;
  } | null;
  cacheCheckDuration: number;
}

/**
 * Check cache for span labeling payload
 */
export function checkCache(payload: SpanLabelingPayload): CacheCheckResult {
  const cacheCheckStart = performance.now();
  const cached = spanLabelingCache.get(payload);
  const cacheCheckDuration = performance.now() - cacheCheckStart;

  if (cached) {
    return {
      cached: {
        spans: cached.spans,
        meta: cached.meta ?? null,
        cacheId: cached.cacheId ?? payload.cacheId ?? null,
        signature: cached.signature,
      },
      cacheCheckDuration,
    };
  }

  return {
    cached: null,
    cacheCheckDuration,
  };
}

/**
 * Calculate effective debounce time
 */
export function calculateEffectiveDebounce(
  payload: SpanLabelingPayload,
  options: SchedulerOptions
): number {
  if (options.immediate || options.debounceMs === 0) {
    return 0;
  }

  if (options.useSmartDebounce) {
    return calculateSmartDebounce(payload.text);
  }

  return options.debounceMs;
}

/**
 * Create initial state for disabled scheduler
 */
export function createDisabledState(): SpanLabelingState {
  return {
    spans: [],
    meta: null,
    status: 'idle',
    error: null,
  };
}

/**
 * Create loading state for request
 */
export function createLoadingState(
  immediate: boolean,
  previousStatus: string,
  previousSpans: unknown[],
  previousMeta: unknown | null
): SpanLabelingState {
  const preservingPrevious = immediate && previousStatus === 'success';
  return {
    spans: preservingPrevious ? (previousSpans as LabeledSpan[]) : [],
    meta: preservingPrevious ? (previousMeta as SpanMeta | null) : null,
    status:
      previousStatus === 'success' && !immediate ? 'refreshing' : 'loading',
    error: null,
  };
}

