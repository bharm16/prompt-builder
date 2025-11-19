import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_POLICY, DEFAULT_OPTIONS, calculateSmartDebounce } from '../config/index.js';
import { sanitizeText, hashString } from '../utils/index.js';
import { spanLabelingCache } from '../services/index.js';
import { SpanLabelingApi } from '../api/index.js';

export const createHighlightSignature = (text) => hashString(sanitizeText(text ?? ''));

/**
 * Hook to call the /llm/label-spans endpoint with debounce + cancellation.
 * @param {Object} args
 * @param {string} args.text
 * @param {boolean} [args.enabled]
 * @param {boolean} [args.immediate] - Skip debounce entirely for instant processing (default: false)
 * @param {number} [args.maxSpans]
 * @param {number} [args.minConfidence]
 * @param {Object} [args.policy]
 * @param {string} [args.templateVersion]
 * @param {number} [args.debounceMs] - Fixed debounce delay (used when useSmartDebounce is false)
 * @param {boolean} [args.useSmartDebounce] - Enable smart debouncing based on text length (default: true)
 */
export function useSpanLabeling({
  text,
  initialData = null,
  initialDataVersion = 0,
  cacheKey = null,
  enabled = true,
  immediate = false,
  maxSpans = DEFAULT_OPTIONS.maxSpans,
  minConfidence = DEFAULT_OPTIONS.minConfidence,
  policy,
  templateVersion = DEFAULT_OPTIONS.templateVersion,
  debounceMs = DEFAULT_OPTIONS.debounceMs,
  useSmartDebounce = DEFAULT_OPTIONS.useSmartDebounce,
  onResult,
} = {}) {
  const [state, setState] = useState({
    spans: [],
    meta: null,
    status: 'idle',
    error: null,
  });

  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const lastPayloadRef = useRef(null);
  const onResultRef = useRef(onResult);
  const lastEmitKeyRef = useRef(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const mergedPolicy = useMemo(() => {
    if (!policy || typeof policy !== 'object') {
      return { ...DEFAULT_POLICY };
    }
    return {
      ...DEFAULT_POLICY,
      ...policy,
      allowOverlap: policy.allowOverlap === true,
    };
  }, [policy]);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

const performRequest = useCallback(async (payload, signal) => {
  return SpanLabelingApi.labelSpans(payload, signal);
}, []);

  const emitResult = useCallback(
    ({ spans, meta, text, cacheId, signature }, source) => {
      if (!onResultRef.current) return;
      if (!Array.isArray(spans) || !spans.length) return;
      const normalizedText = sanitizeText(text);
      const effectiveSignature = signature ?? hashString(normalizedText ?? '');
      const key = `${effectiveSignature}::${source}`;
      if (lastEmitKeyRef.current === key) {
        return;
      }
      lastEmitKeyRef.current = key;
      onResultRef.current({
        spans,
        meta: meta ?? null,
        text: normalizedText,
        signature: effectiveSignature,
        cacheId: cacheId ?? null,
        source,
      });
    },
    []
  );

  const schedule = useCallback(
    (payload, immediate = false) => {
      // ⏱️ PERFORMANCE TIMER: Span labeling starts
      performance.mark('span-labeling-start');

      cancelPending();

      if (!enabled) {
        lastPayloadRef.current = null;
        setState({
          spans: [],
          meta: null,
          status: 'idle',
          error: null,
        });
        return;
      }

      lastPayloadRef.current = payload;

      if (!immediate) {
        const cacheCheckStart = performance.now();
        const cached = spanLabelingCache.get(payload);
        const cacheCheckDuration = performance.now() - cacheCheckStart;

        if (cached) {
          // ⏱️ PERFORMANCE TIMER: Cache hit
          performance.mark('span-cache-hit');
          performance.measure('span-labeling-cache-hit', 'span-labeling-start', 'span-cache-hit');

          setState({
            spans: Array.isArray(cached.spans) ? cached.spans : [],
            meta: cached.meta ?? null,
            status: 'success',
            error: null,
          });
          emitResult(
            {
              spans: cached.spans,
              meta: cached.meta,
              text: payload.text,
              cacheId: cached.cacheId ?? payload.cacheId,
              signature: cached.signature,
            },
            immediate ? 'refresh-cache' : 'cache'
          );
          return;
        }
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setState((prev) => {
        const preservingPrevious = immediate && prev.status === 'success';
        return {
          spans: preservingPrevious ? prev.spans : [],
          meta: preservingPrevious ? prev.meta : null,
          status:
            prev.status === 'success' && !immediate
              ? 'refreshing'
              : 'loading',
          error: null,
        };
      });

      const controller = new AbortController();
      abortRef.current = controller;

      const run = async (controller) => {
        try {
          // ⏱️ PERFORMANCE TIMER: API request start
          performance.mark('span-api-start');

          const result = await performRequest(payload, controller.signal);

          // ⏱️ PERFORMANCE TIMER: API request complete
          performance.mark('span-api-complete');
          performance.measure('span-api-duration', 'span-api-start', 'span-api-complete');
          performance.measure('span-labeling-total', 'span-labeling-start', 'span-api-complete');

          if (requestId !== requestIdRef.current) {
            return;
          }
          const signature = hashString(payload.text ?? '');
          const normalizedResult = {
            spans: result.spans,
            meta: result.meta,
            signature,
          };
          setState({
            spans: normalizedResult.spans,
            meta: normalizedResult.meta,
            status: 'success',
            error: null,
          });
          spanLabelingCache.set(payload, normalizedResult);
          emitResult(
            {
              spans: normalizedResult.spans,
              meta: normalizedResult.meta,
              text: payload.text,
              cacheId: payload.cacheId,
              signature,
            },
            'network'
          );
        } catch (error) {
          // Abort and stale request checks - ignore these errors silently
          if (controller.signal.aborted) {
            return;
          }
          if (requestId !== requestIdRef.current) {
            return;
          }

          // ============================================================
          // ENHANCED FALLBACK MECHANISM
          // ============================================================
          //
          // When the network request fails (API error, timeout, network issue),
          // we implement a graceful degradation strategy using cached results.
          //
          // Fallback Decision Tree:
          //
          // 1. Network Request Fails
          //    ├─> Check for cached result
          //    │   ├─> Cache Hit (from memory or localStorage)
          //    │   │   └─> Return cached spans with 'success' status
          //    │   │       - User sees last known good result
          //    │   │       - No error shown to user
          //    │   │       - Emit 'cache-fallback' event for monitoring
          //    │   │
          //    │   └─> Cache Miss (no previous result for this text)
          //    │       └─> Set error state
          //    │           - Show error UI to user
          //    │           - Return empty spans array
          //    │           - Error can be retried by user
          //
          // Cache Lookup Strategy (Multi-tier):
          // - Tier 1: In-memory Map cache (fastest, <1ms)
          // - Tier 2: localStorage cache (fast, ~2-5ms)
          // - Cache key includes: text hash + policy + templateVersion + maxSpans + minConfidence
          //
          // Why This Approach?
          // - Improves perceived reliability: Users see cached results instead of errors
          // - Reduces frustration during temporary network issues
          // - Maintains user flow: Editing continues even if API is down
          // - Transparent degradation: Status remains 'success', no error UI shown
          //
          // Monitoring:
          // - 'cache-fallback' events are emitted for analytics
          // - Track fallback rate to detect API health issues
          //
          // ============================================================

          const fallback = spanLabelingCache.get(payload);

          if (fallback) {
            // DEGRADED PATH: Fallback to cached result with error preservation
            // Shows cached data but preserves error information for monitoring and user feedback
            const cacheAge = Date.now() - (fallback.timestamp || 0);
            
            setState({
              spans: Array.isArray(fallback.spans) ? fallback.spans : [],
              meta: {
                ...fallback.meta,
                source: 'cache-fallback',
                cacheAge,
                error: error.message,
              },
              status: 'stale', // New status: indicates cached/stale data due to network failure
              error: error,    // Preserve error for debugging and monitoring
            });

            // Log warning for monitoring (helps detect API health issues)
            console.warn('Span labeling network error - using cached fallback', {
              error: error.message,
              cacheAgeMs: cacheAge,
              textLength: payload.text?.length,
            });

            emitResult(
              {
                spans: fallback.spans,
                meta: {
                  ...fallback.meta,
                  source: 'cache-fallback',
                  cacheAge,
                  error: error.message,
                },
                text: payload.text,
                cacheId: fallback.cacheId ?? payload.cacheId,
                signature: fallback.signature,
              },
              'cache-fallback' // Event type for monitoring/analytics
            );

            // Exit early - user sees cached result with warning indicator
            return;
          }

          // FAILURE PATH: No cached result available
          // This is the only case where we show an error to the user
          setState({
            spans: [],
            meta: null,
            status: 'error',
            error, // Original error from API request
          });
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      };

      // Use immediate flag to skip debounce for initial optimization
      // This saves 200-500ms on first load while keeping debounce for user edits
      if (immediate || debounceMs === 0) {
        run(controller);
      } else {
        // Calculate smart debounce based on text length for better performance
        // Short texts get faster processing, long texts get more conservative delays
        const effectiveDebounce = useSmartDebounce
          ? calculateSmartDebounce(payload.text)
          : debounceMs;

        debounceRef.current = setTimeout(() => {
          run(controller);
        }, effectiveDebounce);
      }
    },
    [cancelPending, debounceMs, useSmartDebounce, enabled, performRequest, immediate]
  );

  useEffect(() => {
    const normalized = sanitizeText(text);
    if (!enabled || !normalized.trim()) {
      cancelPending();
      setState({
        spans: [],
        meta: null,
        status: 'idle',
        error: null,
      });
      return;
    }

    const payload = {
      text: normalized,
      cacheId: cacheKey ?? undefined,
      maxSpans,
      minConfidence,
      policy: mergedPolicy,
      templateVersion,
    };

    lastPayloadRef.current = payload;

    const initialMatch =
      initialData &&
      Array.isArray(initialData.spans) &&
      initialData.spans.length > 0 &&
      initialData.signature === hashString(normalized ?? '') &&
      initialData.meta?.version === templateVersion; // Invalidate old versions

    if (initialMatch) {
      cancelPending();
      setState({
        spans: initialData.spans,
        meta: initialData.meta ?? null,
        status: 'success',
        error: null,
      });
      spanLabelingCache.set(payload, {
        spans: initialData.spans,
        meta: initialData.meta ?? null,
        signature: initialData.signature ?? hashString(normalized ?? ''),
      });
      emitResult(
        {
          spans: initialData.spans,
          meta: initialData.meta,
          text: normalized,
          cacheId: payload.cacheId,
          signature: initialData.signature,
        },
        'initial'
      );
      return;
    }

    schedule(payload, false);
    return () => cancelPending();
  }, [
    text,
    enabled,
    maxSpans,
    minConfidence,
    mergedPolicy,
    templateVersion,
    schedule,
    cancelPending,
    cacheKey,
    initialData,
    initialDataVersion,
    emitResult,
  ]);

  const refresh = useCallback(() => {
    if (!lastPayloadRef.current) return;
    schedule(lastPayloadRef.current, true);
  }, [schedule]);

  useEffect(() => () => cancelPending(), [cancelPending]);

  return {
    spans: state.spans,
    meta: state.meta,
    status: state.status,
    error: state.error,
    refresh,
  };
}

export const __clearSpanLabelingCache = () => {
  spanLabelingCache.clear();
};

export const __getSpanLabelingCacheSnapshot = () => {
  return spanLabelingCache.getSnapshot();
};
