/**
 * useSpanLabeling - Orchestrator Hook
 *
 * Coordinates span labeling workflow by delegating to:
 * - SpanLabelingApi: API calls
 * - spanLabelingCache: Caching
 * - spanLabelingScheduler: Scheduling/debouncing
 * - spanLabelingErrorHandler: Error handling
 * - spanLabelingResultEmitter: Result emission
 *
 * Single Responsibility: Orchestrate the span labeling workflow
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_POLICY, DEFAULT_OPTIONS } from '../config/index.ts';
import { sanitizeText, hashString } from '../utils/index.ts';
import { spanLabelingCache } from '../services/index.ts';
import { SpanLabelingApi } from '../api/index.ts';
import {
  checkCache,
  calculateEffectiveDebounce,
  createDisabledState,
  createLoadingState,
} from '../utils/spanLabelingScheduler.ts';
import {
  shouldHandleError,
  createFallbackResult,
  createErrorStateWithFallback,
  createErrorState,
  logErrorWarning,
} from '../utils/spanLabelingErrorHandler.ts';
import type {
  LabeledSpan,
  SpanMeta,
  SpanLabelingResult,
  SpanLabelingStatus,
  SpanLabelingState,
  SpanLabelingPolicy,
  SpanLabelingPayload,
  InitialData,
  UseSpanLabelingOptions,
  UseSpanLabelingReturn,
} from './types';

// Re-export types for backward compatibility
export type {
  LabeledSpan,
  SpanMeta,
  SpanLabelingResult,
  SpanLabelingStatus,
  SpanLabelingState,
  SpanLabelingPolicy,
  SpanLabelingPayload,
  InitialData,
  UseSpanLabelingOptions,
  UseSpanLabelingReturn,
} from './types';

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
  const requestVersionRef = useRef(0);
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
    requestVersionRef.current += 1;
  }, []);

  const performRequest = useCallback(
    async (
      payload: SpanLabelingPayload,
      signal: AbortSignal | null
    ): Promise<{ spans: LabeledSpan[]; meta: SpanMeta | null }> => {
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
        spans: LabeledSpan[];
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
      performance.mark('span-labeling-start');

      cancelPending();

      if (!enabled) {
        lastPayloadRef.current = null;
        setState(createDisabledState());
        return;
      }

      lastPayloadRef.current = payload;

      // Check cache if not immediate
      if (!immediate) {
        const cacheResult = checkCache(payload);

        if (cacheResult.cached) {
          performance.mark('span-cache-hit');
          performance.measure(
            'span-labeling-cache-hit',
            'span-labeling-start',
            'span-cache-hit'
          );

          setState({
            spans: Array.isArray(cacheResult.cached.spans)
              ? cacheResult.cached.spans
              : [],
            meta: cacheResult.cached.meta as SpanMeta | null,
            status: 'success',
            error: null,
          });
          emitResult(
            {
              spans: cacheResult.cached.spans as LabeledSpan[],
              meta: cacheResult.cached.meta as SpanMeta | null,
              text: payload.text,
              cacheId: cacheResult.cached.cacheId ?? payload.cacheId ?? null,
              signature: cacheResult.cached.signature,
            },
            immediate ? 'refresh-cache' : 'cache'
          );
          return;
        }
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const requestVersion = requestVersionRef.current;

      setState((prev) =>
        createLoadingState(immediate, prev.status, prev.spans, prev.meta)
      );

      const controller = new AbortController();
      abortRef.current = controller;

      const run = async (controller: AbortController): Promise<void> => {
        try {
          performance.mark('span-api-start');

          const result = await performRequest(payload, controller.signal);

          performance.mark('span-api-complete');
          performance.measure(
            'span-api-duration',
            'span-api-start',
            'span-api-complete'
          );
          performance.measure(
            'span-labeling-total',
            'span-labeling-start',
            'span-api-complete'
          );

          // Check for stale requests
          if (
            requestId !== requestIdRef.current ||
            requestVersion !== requestVersionRef.current
          ) {
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
              cacheId: payload.cacheId ?? null,
              signature,
            },
            'network'
          );
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          if (
            !shouldHandleError({
              requestId,
              requestVersion,
              currentRequestId: requestIdRef.current,
              currentRequestVersion: requestVersionRef.current,
              controllerAborted: controller.signal.aborted,
            })
          ) {
            return;
          }

          const fallbackResult = createFallbackResult(payload, errorObj);

          if (fallbackResult) {
            setState(createErrorStateWithFallback(fallbackResult, errorObj));
            logErrorWarning(errorObj, payload, fallbackResult.meta.cacheAge);
            emitResult(fallbackResult, 'cache-fallback');
            return;
          }

          setState(createErrorState(errorObj));
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      };

      const effectiveDebounce = calculateEffectiveDebounce(payload, {
        enabled,
        debounceMs,
        useSmartDebounce,
        immediate,
      });

      if (effectiveDebounce === 0) {
        run(controller);
      } else {
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
      setState(createDisabledState());
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
      initialData.meta?.version === templateVersion;

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
          cacheId: payload.cacheId ?? null,
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

  useEffect(() => () => cancelPending(), []);

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
