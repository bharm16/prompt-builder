import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_POLICY, DEFAULT_OPTIONS, calculateSmartDebounce } from '../config/index.ts';
import { sanitizeText, hashString } from '../utils/index.ts';
import { spanLabelingCache } from '../services/index.ts';
import { SpanLabelingApi } from '../api/index.ts';

export interface Span {
  start: number;
  end: number;
  category: string;
  confidence: number;
}

export interface SpanMeta extends Record<string, unknown> {
  version?: string;
  source?: string;
  cacheAge?: number;
  error?: string;
}

export interface SpanLabelingResult {
  spans: Span[];
  meta: SpanMeta | null;
  text: string;
  signature: string;
  cacheId: string | null;
  source: 'initial' | 'cache' | 'network' | 'cache-fallback' | 'refresh-cache';
}

export type SpanLabelingStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error' | 'stale';

export interface SpanLabelingState {
  spans: Span[];
  meta: SpanMeta | null;
  status: SpanLabelingStatus;
  error: Error | null;
}

export interface SpanLabelingPolicy {
  nonTechnicalWordLimit?: number;
  allowOverlap: boolean;
}

export interface SpanLabelingPayload {
  text: string;
  cacheId?: string;
  maxSpans?: number;
  minConfidence?: number;
  policy?: SpanLabelingPolicy;
  templateVersion?: string;
}

export interface InitialData {
  spans: Span[];
  meta: SpanMeta | null;
  signature: string;
}

export interface UseSpanLabelingOptions {
  text: string | null | undefined;
  initialData?: InitialData | null;
  initialDataVersion?: number;
  cacheKey?: string | null;
  enabled?: boolean;
  immediate?: boolean;
  maxSpans?: number;
  minConfidence?: number;
  policy?: Partial<SpanLabelingPolicy>;
  templateVersion?: string;
  debounceMs?: number;
  useSmartDebounce?: boolean;
  onResult?: (result: SpanLabelingResult) => void;
}

export interface UseSpanLabelingReturn {
  spans: Span[];
  meta: SpanMeta | null;
  status: SpanLabelingStatus;
  error: Error | null;
  refresh: () => void;
}

export const createHighlightSignature = (text: string | null | undefined): string => {
  return hashString(sanitizeText(text ?? ''));
};

/**
 * Hook to call the /llm/label-spans endpoint with debounce + cancellation.
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
}: UseSpanLabelingOptions = {}): UseSpanLabelingReturn {
  const [state, setState] = useState<SpanLabelingState>({
    spans: [],
    meta: null,
    status: 'idle',
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);
  const requestVersionRef = useRef(0); // Track request versions for race condition prevention
  const lastPayloadRef = useRef<SpanLabelingPayload | null>(null);
  const onResultRef = useRef(onResult);
  const lastEmitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const mergedPolicy = useMemo((): SpanLabelingPolicy => {
    if (!policy || typeof policy !== 'object') {
      return { ...DEFAULT_POLICY };
    }
    return {
      ...DEFAULT_POLICY,
      ...policy,
      allowOverlap: policy.allowOverlap === true,
    };
  }, [policy]);

  const cancelPending = useCallback((): void => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    // Increment version to invalidate any in-flight requests
    requestVersionRef.current += 1;
  }, []);

  const performRequest = useCallback(
    async (payload: SpanLabelingPayload, signal: AbortSignal | null): Promise<{ spans: Span[]; meta: SpanMeta | null }> => {
      return SpanLabelingApi.labelSpans(payload, signal);
    },
    []
  );

  const emitResult = useCallback(
    (
      {
        spans,
        meta,
        text,
        cacheId,
        signature,
      }: {
        spans: Span[];
        meta: SpanMeta | null;
        text: string;
        cacheId?: string | null;
        signature: string;
      },
      source: SpanLabelingResult['source']
    ): void => {
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
    (payload: SpanLabelingPayload, immediate = false): void => {
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
      
      // Capture current version for this request
      const requestVersion = requestVersionRef.current;

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

      const run = async (controller: AbortController): Promise<void> => {
        try {
          // ⏱️ PERFORMANCE TIMER: API request start
          performance.mark('span-api-start');

          const result = await performRequest(payload, controller.signal);

          // ⏱️ PERFORMANCE TIMER: API request complete
          performance.mark('span-api-complete');
          performance.measure('span-api-duration', 'span-api-start', 'span-api-complete');
          performance.measure('span-labeling-total', 'span-labeling-start', 'span-api-complete');

          // CRITICAL: Check both requestId and version to prevent race conditions
          // requestId prevents processing old responses
          // requestVersion prevents processing if request was cancelled
          if (requestId !== requestIdRef.current || requestVersion !== requestVersionRef.current) {
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
          // Check both requestId and version to prevent stale updates
          if (requestId !== requestIdRef.current || requestVersion !== requestVersionRef.current) {
            return;
          }

          const errorObj = error instanceof Error ? error : new Error(String(error));

          const fallback = spanLabelingCache.get(payload);

          if (fallback) {
            // DEGRADED PATH: Fallback to cached result with error preservation
            const cacheAge = Date.now() - (fallback.timestamp || 0);
            
            setState({
              spans: Array.isArray(fallback.spans) ? fallback.spans : [],
              meta: {
                ...fallback.meta,
                source: 'cache-fallback',
                cacheAge,
                error: errorObj.message,
              } as SpanMeta,
              status: 'stale', // New status: indicates cached/stale data due to network failure
              error: errorObj,    // Preserve error for debugging and monitoring
            });

            // Log warning for monitoring (helps detect API health issues)
            console.warn('Span labeling network error - using cached fallback', {
              error: errorObj.message,
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
                  error: errorObj.message,
                } as SpanMeta,
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
          setState({
            spans: [],
            meta: null,
            status: 'error',
            error: errorObj,
          });
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      };

      // Use immediate flag to skip debounce for initial optimization
      if (immediate || debounceMs === 0) {
        run(controller);
      } else {
        // Calculate smart debounce based on text length for better performance
        const effectiveDebounce = useSmartDebounce
          ? calculateSmartDebounce(payload.text)
          : debounceMs;

        debounceRef.current = setTimeout(() => {
          run(controller);
        }, effectiveDebounce);
      }
    },
    [cancelPending, debounceMs, useSmartDebounce, enabled, performRequest, emitResult]
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

    const payload: SpanLabelingPayload = {
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

    schedule(payload, immediate);
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
    immediate,
  ]);

  const refresh = useCallback((): void => {
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

export const __clearSpanLabelingCache = (): void => {
  spanLabelingCache.clear();
};

export const __getSpanLabelingCacheSnapshot = (): unknown => {
  return spanLabelingCache.getSnapshot();
};

