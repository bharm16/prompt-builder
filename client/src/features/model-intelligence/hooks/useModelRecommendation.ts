import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchModelRecommendation } from '../api';
import type { ModelRecommendation } from '../types';
import { logger } from '@/services/LoggingService';

interface UseModelRecommendationOptions {
  mode?: 't2v' | 'i2v';
  durationSeconds?: number;
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

export function useModelRecommendation(
  prompt: string,
  {
    mode = 't2v',
    durationSeconds,
    debounceMs = 500,
    enabled = true,
  }: UseModelRecommendationOptions = {}
): UseModelRecommendationResult {
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(() => {
    if (!enabled) return;
    if (!prompt || prompt.trim().length < 10) {
      setRecommendation(null);
      return;
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
        ...(typeof durationSeconds === 'number' ? { durationSeconds } : {}),
      },
      controller.signal
    )
      .then((data) => {
        setRecommendation(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Failed to load recommendation';
        log.warn('Model recommendation request failed', { error: message });
        setError(message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });
  }, [durationSeconds, enabled, mode, prompt]);

  useEffect(() => {
    if (!enabled) return;
    const timeoutId = window.setTimeout(runFetch, debounceMs);
    return () => {
      window.clearTimeout(timeoutId);
      abortRef.current?.abort();
    };
  }, [debounceMs, enabled, runFetch]);

  return {
    recommendation,
    isLoading,
    error,
    refetch: runFetch,
  };
}
