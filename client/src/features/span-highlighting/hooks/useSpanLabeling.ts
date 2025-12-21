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
import { SpanLabelingApi } from '../api/index.ts';
import { createDisabledState, createLoadingState } from '../utils/spanLabelingScheduler.ts';
import {
  shouldHandleError,
  createFallbackResult,
  createErrorStateWithFallback,
  createErrorState,
  logErrorWarning,
} from '../utils/spanLabelingErrorHandler.ts';
import { useAsyncScheduler } from './useAsyncScheduler.ts';
import { useSpanLabelingCache } from './useSpanLabelingCache.ts';
import { useSpanLabelingCacheService } from '../context/SpanLabelingContext.tsx';
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
 * Deep compare memoization helper
 * Stabilizes object references by comparing JSON serialization
 * Used internally to prevent infinite loops from unstable callers
 */
function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T>(value);
  const signalRef = useRef<number>(0);

  if (JSON.stringify(value) !== JSON.stringify(ref.current)) {
    ref.current = value;
    signalRef.current += 1;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ref.current, [signalRef.current]);
}

/**
 * Hook to call the /llm/label-spans endpoint with debounce + cancellation.
 *
 * @example
 * ```tsx
 * // ✅ RECOMMENDED: Use useMemo for policy to ensure referential stability
 * // This is especially important if you plan to add user-configurable settings later
 * const policy = useMemo(() => ({
 *   allowOverlap: true,
 *   nonTechnicalWordLimit: 10
 * }), []); // Empty deps if static, or [userSetting] if dynamic
 *
 * useSpanLabeling({
 *   text: input,
 *   policy
 * });
 * ```
 *
 * @example
 * ```tsx
 * // ✅ Also works: Dynamic policy based on user settings
 * const policy = useMemo(() => ({
 *   allowOverlap: userSettings.allowOverlaps,
 *   nonTechnicalWordLimit: userSettings.wordLimit
 * }), [userSettings.allowOverlaps, userSettings.wordLimit]);
 * ```
 *
 * **Why useMemo?**
 * - Ensures referential stability (object identity doesn't change on every render)
 * - Future-proofs for user-configurable settings
 * - Follows React best practices for object dependencies
 * - Prevents unnecessary re-renders and cache invalidation
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
    signature: null,
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

  // 1. Stabilize the Policy internally using deep comparison
  // This prevents infinite loops even if caller forgets to useMemo
  const stablePolicy = useDeepCompareMemoize(policy);
  const mergedPolicy = useMemo((): SpanLabelingPolicy => {
    if (!stablePolicy || typeof stablePolicy !== 'object') {
      return { ...DEFAULT_POLICY };
    }
    return {
      ...DEFAULT_POLICY,
      ...stablePolicy,
      allowOverlap: stablePolicy.allowOverlap === true,
    };
  }, [stablePolicy]);

  // 2. Stabilize initialData using signature-based comparison
  // This prevents infinite loops if caller passes new object with same content
  const initialDataRef = useRef(initialData);
  const stableInitialData = useMemo(() => {
    const current = initialDataRef.current;

    // Check if identity changed but content signature is identical
    if (
      initialData !== current &&
      initialData?.signature === current?.signature &&
      initialData?.meta?.version === current?.meta?.version
    ) {
      // Return the OLD reference to prevent effect firing
      return current;
    }

    // Content actually changed, update ref and return new reference
    initialDataRef.current = initialData;
    return initialData;
  }, [initialData]);

  // Get cache service from context (dependency injection)
  const cacheService = useSpanLabelingCacheService();
  const { checkCache: checkCacheForPayload, setCache: setCacheForPayload } = useSpanLabelingCache(cacheService);

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

  // Memoize callbacks to prevent recreating the schedule function on every render
  const onLoadingState = useCallback(
    (immediate: boolean) => {
      setState((prev) =>
        createLoadingState(immediate, prev.status, prev.spans, prev.meta, prev.signature)
      );
    },
    []
  );

  const onSuccess = useCallback(
    (result: unknown, payload: SpanLabelingPayload) => {
      const apiResult = result as { spans: LabeledSpan[]; meta: SpanMeta | null };
      const signature = hashString(payload.text ?? '');
      const normalizedResult = {
        spans: apiResult.spans,
        meta: apiResult.meta,
        signature,
      };

      setState({
        spans: normalizedResult.spans,
        meta: normalizedResult.meta,
        status: 'success',
        error: null,
        signature,
      });

      setCacheForPayload(payload, normalizedResult);
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
    },
    [setCacheForPayload, emitResult]
  );

  const onError = useCallback(
    (error: Error, payload: SpanLabelingPayload) => {
      const fallbackResult = createFallbackResult(payload, error, cacheService);

      if (fallbackResult) {
        setState(createErrorStateWithFallback(fallbackResult, error));
        logErrorWarning(error, payload, fallbackResult.meta.cacheAge);
        emitResult(fallbackResult, 'cache-fallback');
        return;
      }

      setState(createErrorState(error));
    },
    [emitResult, cacheService]
  );

  // Stabilize callbacks object to prevent infinite re-renders
  const callbacks = useMemo(
    () => ({
      onExecute: performRequest,
      onLoadingState,
      onSuccess,
      onError,
    }),
    [performRequest, onLoadingState, onSuccess, onError]
  );

  // Use async scheduler for debouncing and abort management
  // Note: Stale request checking is handled inside useAsyncScheduler before callbacks are invoked
  const { schedule: scheduleRequest, cancelPending } = useAsyncScheduler(
    {
      enabled,
      debounceMs,
      useSmartDebounce,
      immediate,
    },
    callbacks
  );

  const schedule = useCallback(
    (payload: SpanLabelingPayload, immediate = false): void => {
      performance.mark('span-labeling-start');

      if (!enabled) {
        lastPayloadRef.current = null;
        setState(createDisabledState());
        return;
      }

      lastPayloadRef.current = payload;

      // Check cache if not immediate
      if (!immediate) {
        const cacheResult = checkCacheForPayload(payload);

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
            signature: cacheResult.cached.signature,
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

      // Schedule API request
      scheduleRequest(payload, immediate);
    },
    [enabled, checkCacheForPayload, scheduleRequest, emitResult]
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
      maxSpans,
      minConfidence,
      policy: mergedPolicy,
      templateVersion,
      ...(typeof cacheKey === 'string' ? { cacheId: cacheKey } : {}),
    };

    lastPayloadRef.current = payload;

    // Use stableInitialData to prevent infinite loops
    // Check if this is a local update (from applying a suggestion) - if so, trust it
    const isLocalUpdate = Boolean(
      stableInitialData?.meta &&
      (stableInitialData.meta as Record<string, unknown>).localUpdate === true
    );

    const initialMatch =
      stableInitialData &&
      Array.isArray(stableInitialData.spans) &&
      stableInitialData.spans.length > 0 &&
      stableInitialData.signature === hashString(normalized ?? '') &&
      (isLocalUpdate || stableInitialData.meta?.version === templateVersion);

    // Debug: trace initialMatch evaluation
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[useSpanLabeling] initialMatch check:', {
        hasStableData: Boolean(stableInitialData),
        hasSpans: Array.isArray(stableInitialData?.spans) && stableInitialData.spans.length > 0,
        isLocalUpdate,
        signatureMatch: stableInitialData?.signature === hashString(normalized ?? ''),
        stableSignature: stableInitialData?.signature?.slice(0, 16),
        textSignature: hashString(normalized ?? '').slice(0, 16),
        versionMatch: stableInitialData?.meta?.version === templateVersion,
        initialMatch,
      });
    }

    if (initialMatch) {
      cancelPending();
      setState({
        spans: stableInitialData.spans,
        meta: stableInitialData.meta ?? null,
        status: 'success',
        error: null,
        signature: stableInitialData.signature ?? hashString(normalized ?? ''),
      });
      setCacheForPayload(payload, {
        spans: stableInitialData.spans,
        meta: stableInitialData.meta ?? null,
        signature: stableInitialData.signature ?? hashString(normalized ?? ''),
      });
      emitResult(
        {
          spans: stableInitialData.spans,
          meta: stableInitialData.meta,
          text: normalized,
          cacheId: payload.cacheId ?? null,
          signature: stableInitialData.signature,
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
    mergedPolicy, // Now stable via useDeepCompareMemoize
    templateVersion,
    schedule,
    cancelPending,
    cacheKey,
    stableInitialData, // DEPEND ON THIS, NOT initialData - prevents infinite loops
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
    signature: state.signature,
    refresh,
  };
}

// Note: Cache clearing/snapshot functions moved to cache service
// Access via useSpanLabelingCacheService() hook if needed
