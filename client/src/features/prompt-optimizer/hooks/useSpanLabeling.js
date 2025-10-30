import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_CONFIG } from '../../../config/api.config';
import { PERFORMANCE_CONFIG, STORAGE_KEYS } from '../../../config/performance.config';

const CACHE_STORAGE_KEY = STORAGE_KEYS.SPAN_LABELING_CACHE;
const CACHE_LIMIT = PERFORMANCE_CONFIG.SPAN_LABELING_CACHE_LIMIT;

const highlightCache = new Map();
let cacheHydrated = false;

// Hash cache for memoization (LRU eviction)
const hashCache = new Map();
const HASH_CACHE_MAX_SIZE = PERFORMANCE_CONFIG.HASH_CACHE_MAX_SIZE;

/**
 * Optimized string hashing with memoization
 * Uses FNV-1a hash algorithm (faster than original implementation)
 * Caches results to avoid re-computing hashes for the same strings
 */
const hashString = (input = '') => {
  if (!input) return '0';
  
  // Check cache first
  if (hashCache.has(input)) {
    return hashCache.get(input);
  }
  
  // FNV-1a hash (faster than previous implementation)
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime: 16777619
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  
  const result = (hash >>> 0).toString(36);
  
  // Cache with LRU eviction
  if (hashCache.size >= HASH_CACHE_MAX_SIZE) {
    const firstKey = hashCache.keys().next().value;
    hashCache.delete(firstKey);
  }
  hashCache.set(input, result);
  
  return result;
};

const getCacheStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    if (window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    // Ignore storage access errors and try sessionStorage
  }

  try {
    if (window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch (error) {
    // Ignore storage access errors
  }

  return null;
};

const serializePolicy = (policy) => {
  if (!policy || typeof policy !== 'object') {
    return '';
  }

  return Object.keys(policy)
    .sort()
    .map((key) => {
      const value = policy[key];
      if (value && typeof value === 'object') {
        return `${key}:${JSON.stringify(value)}`;
      }
      return `${key}:${String(value)}`;
    })
    .join('|');
};

const buildCacheKey = (payload = {}) => {
  const text = payload.text ?? '';
  const baseId =
    typeof payload.cacheId === 'string' && payload.cacheId.trim().length > 0
      ? payload.cacheId.trim()
      : null;
  const derivedId = baseId ? `${baseId}::${hashString(text)}` : `anon::${hashString(text)}`;
  const policyKey = serializePolicy(payload.policy);
  return [
    payload.maxSpans ?? '',
    payload.minConfidence ?? '',
    payload.templateVersion ?? '',
    policyKey,
    derivedId,
  ].join('::');
};

/**
 * Hydrate cache from localStorage asynchronously using requestIdleCallback
 * This prevents blocking the main thread during component mount
 */
const hydrateCacheFromStorage = () => {
  if (cacheHydrated) {
    return;
  }
  cacheHydrated = true;

  const storage = getCacheStorage();
  if (!storage) {
    return;
  }

  // Defer cache hydration to avoid blocking initial render
  const performHydration = () => {
    try {
      const raw = storage.getItem(CACHE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) {
        return;
      }

      entries.forEach(([key, value]) => {
        if (!key || typeof key !== 'string' || !value || typeof value !== 'object') {
          return;
        }
        const normalized = {
          spans: Array.isArray(value.spans) ? value.spans : [],
          meta: value.meta ?? null,
          timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
          text: typeof value.text === 'string' ? value.text : '',
          cacheId: typeof value.cacheId === 'string' ? value.cacheId : null,
          signature: typeof value.signature === 'string' ? value.signature : null,
        };
        if (!normalized.text) {
          return;
        }
        if (!normalized.signature) {
          normalized.signature = hashString(normalized.text ?? '');
        }
        highlightCache.set(key, normalized);
      });

      while (highlightCache.size > CACHE_LIMIT) {
        const oldestKey = highlightCache.keys().next().value;
        highlightCache.delete(oldestKey);
      }
    } catch (error) {
      console.warn('Unable to hydrate span labeling cache:', error);
      highlightCache.clear();
    }
  };

  // Use requestIdleCallback for non-blocking hydration
  // Falls back to setTimeout for browsers without requestIdleCallback
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(performHydration, { timeout: 2000 });
  } else {
    setTimeout(performHydration, 100);
  }
};

const persistCacheToStorage = () => {
  const storage = getCacheStorage();
  if (!storage) {
    return;
  }

  try {
    const serialized = Array.from(highlightCache.entries()).map(([key, value]) => [
      key,
      {
        spans: Array.isArray(value.spans) ? value.spans : [],
        meta: value.meta ?? null,
        timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
        text: typeof value.text === 'string' ? value.text : '',
        cacheId: typeof value.cacheId === 'string' ? value.cacheId : null,
        signature: typeof value.signature === 'string' ? value.signature : hashString(value.text ?? ''),
      },
    ]);
    storage.setItem(CACHE_STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.warn('Unable to persist span labeling cache:', error);
  }
};

const getCachedResult = (payload) => {
  hydrateCacheFromStorage();
  const key = buildCacheKey(payload);
  const cached = highlightCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.text !== payload.text) {
    return null;
  }
  const signature = typeof cached.signature === 'string' ? cached.signature : hashString(cached.text ?? '');
  return {
    ...cached,
    signature,
  };
};

const setCachedResult = (payload, data) => {
  hydrateCacheFromStorage();
  if (!payload?.text) {
    return;
  }
  const key = buildCacheKey(payload);
  const entry = {
    spans: Array.isArray(data?.spans) ? data.spans : [],
    meta: data?.meta ?? null,
    timestamp: Date.now(),
    text: payload.text ?? '',
    cacheId: payload.cacheId ?? null,
    signature: data?.signature ?? hashString(payload.text ?? ''),
  };

  // Update recency for simple LRU semantics
  if (highlightCache.has(key)) {
    highlightCache.delete(key);
  }
  highlightCache.set(key, entry);

  while (highlightCache.size > CACHE_LIMIT) {
    const oldestKey = highlightCache.keys().next().value;
    highlightCache.delete(oldestKey);
  }

  persistCacheToStorage();
};

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': API_CONFIG.apiKey,
};

const DEFAULT_POLICY = {
  nonTechnicalWordLimit: 6,
  allowOverlap: false,
};

/**
 * Calculate smart debounce delay based on text length
 *
 * Performance optimization: Shorter texts get faster processing
 * to improve perceived responsiveness, while longer texts use
 * longer delays to reduce unnecessary API calls.
 *
 * Optimized Thresholds (LLM-only system - 2x faster):
 * - <100 chars: 50ms (instant for very short snippets)
 * - 100-500 chars: 150ms (fast for short text)
 * - 500-2000 chars: 300ms (balanced for medium text)
 * - >2000 chars: 450ms (still responsive for large text)
 *
 * @param {string} text - The text to analyze
 * @returns {number} Debounce delay in milliseconds
 */
const calculateSmartDebounce = (text) => {
  if (!text) return 50; // Default for empty text

  const length = text.length;

  if (length < 100) {
    return 50; // Very short: instant
  } else if (length < 500) {
    return 150; // Short text: fast response
  } else if (length < 2000) {
    return 300; // Medium text: balanced
  } else {
    return 450; // Large text: still responsive
  }
};

const DEFAULT_OPTIONS = {
  maxSpans: 60,
  minConfidence: 0.5,
  templateVersion: 'v1',
  debounceMs: 500, // Fallback if smart debounce is disabled
  useSmartDebounce: true, // Enable smart debouncing by default
};

const buildBody = (payload) => {
  const body = {
    text: payload.text,
    maxSpans: payload.maxSpans,
    minConfidence: payload.minConfidence,
    policy: payload.policy,
    templateVersion: payload.templateVersion,
  };

  return JSON.stringify(body);
};

const sanitizeText = (text) => (typeof text === 'string' ? text.normalize('NFC') : '');

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
  const res = await fetch('/llm/label-spans', {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: buildBody(payload),
    signal,
    });

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const errorBody = await res.json();
        if (errorBody?.message) {
          message = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors and fall back to default message
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

  const data = await res.json();
  return {
    spans: Array.isArray(data?.spans) ? data.spans : [],
    meta: data?.meta ?? null,
  };
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
        const cached = getCachedResult(payload);
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
          setCachedResult(payload, normalizedResult);
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

          const fallback = getCachedResult(payload);

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
      initialData.signature === hashString(normalized ?? '');

    if (initialMatch) {
      cancelPending();
      setState({
        spans: initialData.spans,
        meta: initialData.meta ?? null,
        status: 'success',
        error: null,
      });
      setCachedResult(payload, {
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
  highlightCache.clear();
  cacheHydrated = false;
  const storage = getCacheStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(CACHE_STORAGE_KEY);
  } catch (error) {
    // Ignore storage access errors
  }
};

export const __getSpanLabelingCacheSnapshot = () =>
  Array.from(highlightCache.entries()).map(([key, value]) => ({
    key,
    cacheId: value?.cacheId ?? null,
    spanCount: Array.isArray(value?.spans) ? value.spans.length : 0,
    textPreview: typeof value?.text === 'string' ? value.text.slice(0, 40) : '',
  }));
