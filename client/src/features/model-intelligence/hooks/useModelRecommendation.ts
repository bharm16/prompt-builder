import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchModelRecommendation } from '../api';
import { MIN_PROMPT_LENGTH_FOR_RECOMMENDATION } from '../constants';
import type { ModelRecommendation, ModelRecommendationSpan } from '../types';
import { logger } from '@/services/LoggingService';

interface UseModelRecommendationOptions {
  mode?: 't2v' | 'i2v';
  durationSeconds?: number;
  spans?: ModelRecommendationSpan[];
  debounceMs?: number;
  enabled?: boolean;
}

interface UseModelRecommendationResult {
  recommendation: ModelRecommendation | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const log = logger.child('useModelRecommendation');
const RATE_LIMIT_COOLDOWN_MS = 15_000;

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && status === 429;
};

export function useModelRecommendation(
  prompt: string,
  {
    mode = 't2v',
    durationSeconds,
    spans,
    debounceMs = 500,
    enabled = true,
  }: UseModelRecommendationOptions = {}
): UseModelRecommendationResult {
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownTick, setCooldownTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cooldownUntilRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);

  const runFetch = useCallback(() => {
    if (!enabled) return;
    if (!prompt || prompt.trim().length < MIN_PROMPT_LENGTH_FOR_RECOMMENDATION) {
      setRecommendation(null);
      return;
    }
    const cooldownUntil = cooldownUntilRef.current;
    if (typeof cooldownUntil === 'number' && Date.now() < cooldownUntil) {
      return;
    }
    if (typeof cooldownUntil === 'number') {
      cooldownUntilRef.current = null;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchModelRecommendation(
      {
        prompt,
        mode,
        ...(spans?.length ? { spans } : {}),
        ...(typeof durationSeconds === 'number' ? { durationSeconds } : {}),
      },
      controller.signal
    )
      .then((data) => {
        setRecommendation(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (isRateLimitError(err)) {
          const cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          cooldownUntilRef.current = cooldownUntil;
          if (cooldownTimerRef.current !== null) {
            window.clearTimeout(cooldownTimerRef.current);
          }
          cooldownTimerRef.current = window.setTimeout(() => {
            cooldownTimerRef.current = null;
            cooldownUntilRef.current = null;
            setCooldownTick((value) => value + 1);
          }, RATE_LIMIT_COOLDOWN_MS);
          setError('Model recommendation is temporarily rate limited');
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load recommendation';
        log.warn('Model recommendation request failed', { error: message });
        setError(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });
  }, [durationSeconds, enabled, mode, prompt, spans]);

  useEffect(() => {
    if (!enabled) return;
    const timeoutId = window.setTimeout(runFetch, debounceMs);
    return () => {
      window.clearTimeout(timeoutId);
      abortRef.current?.abort();
    };
  }, [cooldownTick, debounceMs, enabled, runFetch]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current !== null) {
        window.clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  return {
    recommendation,
    isLoading,
    error,
    refetch: runFetch,
  };
}
