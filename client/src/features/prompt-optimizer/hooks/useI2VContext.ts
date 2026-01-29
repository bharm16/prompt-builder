import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGenerationControlsContext } from '../context/GenerationControlsContext';
import { observeImage } from '../api/i2vApi';
import {
  deriveLockMap,
  type I2VConstraintMode,
  type I2VContext,
  type ImageObservation,
} from '../types/i2v';

export function useI2VContext(): I2VContext {
  const { keyframes, cameraMotion } = useGenerationControlsContext();
  const startImageUrl = keyframes[0]?.url ?? null;
  const startImageSourcePrompt = keyframes[0]?.sourcePrompt ?? null;
  const [constraintMode, setConstraintModeState] = useState<I2VConstraintMode>('strict');
  const [observation, setObservation] = useState<ImageObservation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastImageRef = useRef<string | null>(null);

  const isI2VMode = Boolean(startImageUrl);
  const cameraMotionLocked = Boolean(cameraMotion?.id);

  const lockMap = useMemo(
    () =>
      isI2VMode
        ? deriveLockMap(constraintMode, { cameraMotionLocked })
        : null,
    [cameraMotionLocked, constraintMode, isI2VMode]
  );

  const setConstraintMode = useCallback((mode: I2VConstraintMode) => {
    setConstraintModeState(mode);
  }, []);

  const refreshObservation = useCallback(async () => {
    if (!startImageUrl) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await observeImage(
        {
          image: startImageUrl,
          ...(startImageSourcePrompt ? { sourcePrompt: startImageSourcePrompt } : {}),
        },
        { signal: controller.signal }
      );

      if (!result.success || !result.observation) {
        setObservation(null);
        setError(result.error || 'Image analysis failed');
        return;
      }

      setObservation(result.observation);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Image analysis failed';
      setObservation(null);
      setError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
      }
    }
  }, [startImageSourcePrompt, startImageUrl]);

  useEffect(() => {
    if (!startImageUrl) {
      abortRef.current?.abort();
      lastImageRef.current = null;
      setObservation(null);
      setError(null);
      setIsAnalyzing(false);
      return;
    }

    const imageKey = `${startImageUrl}|${startImageSourcePrompt ?? ''}`;

    if (lastImageRef.current === imageKey) {
      return;
    }

    lastImageRef.current = imageKey;
    setObservation(null);
    setError(null);
    void refreshObservation();

    return () => {
      abortRef.current?.abort();
    };
  }, [refreshObservation, startImageSourcePrompt, startImageUrl]);

  return {
    isI2VMode,
    startImageUrl,
    startImageSourcePrompt,
    observation,
    lockMap,
    constraintMode,
    isAnalyzing,
    error,
    setConstraintMode,
    refreshObservation,
  };
}
