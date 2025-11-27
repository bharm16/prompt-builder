/**
 * Span Labeling Error Handler Utilities
 *
 * Handles errors during span labeling requests with fallback to cached results.
 */

import { spanLabelingCache } from '../services/index.ts';
import type { SpanLabelingPayload, SpanLabelingState, SpanMeta, LabeledSpan } from '../hooks/types.ts';

export interface ErrorHandlerOptions {
  requestId: number;
  requestVersion: number;
  currentRequestId: number;
  currentRequestVersion: number;
  controllerAborted: boolean;
}

export interface FallbackResult {
  spans: LabeledSpan[];
  meta: SpanMeta;
  cacheId: string | null;
  signature: string;
}

/**
 * Check if error should be handled (not aborted or stale)
 */
export function shouldHandleError(options: ErrorHandlerOptions): boolean {
  if (options.controllerAborted) {
    return false;
  }

  // Check both requestId and version to prevent stale updates
  if (
    options.requestId !== options.currentRequestId ||
    options.requestVersion !== options.currentRequestVersion
  ) {
    return false;
  }

  return true;
}

/**
 * Create fallback result from cache
 */
export function createFallbackResult(
  payload: SpanLabelingPayload,
  error: Error
): FallbackResult | null {
  const fallback = spanLabelingCache.get(payload);

  if (!fallback) {
    return null;
  }

  const cacheAge = Date.now() - (fallback.timestamp || 0);

  return {
    spans: Array.isArray(fallback.spans) ? fallback.spans : [],
    meta: {
      ...fallback.meta,
      source: 'cache-fallback',
      cacheAge,
      error: error.message,
    } as SpanMeta,
    cacheId: fallback.cacheId ?? payload.cacheId ?? null,
    signature: fallback.signature,
  };
}

/**
 * Create error state with fallback
 */
export function createErrorStateWithFallback(
  fallbackResult: FallbackResult,
  error: Error
): SpanLabelingState {
  return {
    spans: fallbackResult.spans,
    meta: fallbackResult.meta,
    status: 'stale',
    error,
  };
}

/**
 * Create error state without fallback
 */
export function createErrorState(error: Error): SpanLabelingState {
  return {
    spans: [],
    meta: null,
    status: 'error',
    error,
  };
}

/**
 * Log error warning for monitoring
 */
export function logErrorWarning(
  error: Error,
  payload: SpanLabelingPayload,
  cacheAge?: number
): void {
  console.warn('Span labeling network error - using cached fallback', {
    error: error.message,
    cacheAgeMs: cacheAge,
    textLength: payload.text?.length,
  });
}

