import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  enabled = true,
  maxSpans = DEFAULT_OPTIONS.maxSpans,
  minConfidence = DEFAULT_OPTIONS.minConfidence,
  policy,
  templateVersion = DEFAULT_OPTIONS.templateVersion,
  debounceMs = DEFAULT_OPTIONS.debounceMs,
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

  const schedule = useCallback(
    (payload, immediate = false) => {
      cancelPending();

      if (!enabled) {
        setState({
          spans: [],
          meta: null,
          status: 'idle',
          error: null,
        });
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      lastPayloadRef.current = payload;

      setState((prev) => ({
        spans: immediate && prev.status === 'success' ? prev.spans : prev.spans,
        meta: immediate && prev.status === 'success' ? prev.meta : prev.meta,
        status:
          prev.status === 'success' && !immediate
            ? 'refreshing'
            : 'loading',
        error: null,
      }));

      const run = async (controller) => {
        try {
          const result = await performRequest(payload, controller.signal);
          if (requestId !== requestIdRef.current) {
            return;
          }
          setState({
            spans: result.spans,
            meta: result.meta,
            status: 'success',
            error: null,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (requestId !== requestIdRef.current) {
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

      const controller = new AbortController();
      abortRef.current = controller;

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
      maxSpans,
      minConfidence,
      policy: mergedPolicy,
      templateVersion,
    };

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
