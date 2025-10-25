import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CACHE_STORAGE_KEY = 'promptBuilder.spanLabelingCache.v1';
const CACHE_LIMIT = 20;

const highlightCache = new Map();
let cacheHydrated = false;

const hashString = (input = '') => {
  if (!input) return '0';
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
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

const hydrateCacheFromStorage = () => {
  if (cacheHydrated) {
    return;
  }
  cacheHydrated = true;

  const storage = getCacheStorage();
  if (!storage) {
    return;
  }

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
  'X-API-Key': 'dev-key-12345',
};

const DEFAULT_POLICY = {
  nonTechnicalWordLimit: 6,
  allowOverlap: false,
};

const DEFAULT_OPTIONS = {
  maxSpans: 60,
  minConfidence: 0.5,
  templateVersion: 'v1',
  debounceMs: 500,
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
 * @param {number} [args.maxSpans]
 * @param {number} [args.minConfidence]
 * @param {Object} [args.policy]
 * @param {string} [args.templateVersion]
 * @param {number} [args.debounceMs]
 */
export function useSpanLabeling({
  text,
  initialData = null,
  initialDataVersion = 0,
  cacheKey = null,
  enabled = true,
  maxSpans = DEFAULT_OPTIONS.maxSpans,
  minConfidence = DEFAULT_OPTIONS.minConfidence,
  policy,
  templateVersion = DEFAULT_OPTIONS.templateVersion,
  debounceMs = DEFAULT_OPTIONS.debounceMs,
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
        const cached = getCachedResult(payload);
        if (cached) {
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
          const result = await performRequest(payload, controller.signal);
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
          if (controller.signal.aborted) {
            return;
          }
          if (requestId !== requestIdRef.current) {
            return;
          }
          const fallback = getCachedResult(payload);
          if (fallback) {
            setState({
              spans: Array.isArray(fallback.spans) ? fallback.spans : [],
              meta: fallback.meta ?? null,
              status: 'success',
              error: null,
            });
            emitResult(
              {
                spans: fallback.spans,
                meta: fallback.meta,
                text: payload.text,
                cacheId: fallback.cacheId ?? payload.cacheId,
                signature: fallback.signature,
              },
              'cache-fallback'
            );
            return;
          }
          setState({
            spans: [],
            meta: null,
            status: 'error',
            error,
          });
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      };

      if (immediate || debounceMs === 0) {
        run(controller);
      } else {
        debounceRef.current = setTimeout(() => run(controller), debounceMs);
      }
    },
    [cancelPending, debounceMs, enabled, performRequest]
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
