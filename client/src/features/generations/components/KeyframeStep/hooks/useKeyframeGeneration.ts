import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset } from '@shared/types/asset';

export interface KeyframeOption {
  imageUrl: string;
  faceStrength: number;
  faceMatchScore?: number;
  model?: string;
}

interface UseKeyframeGenerationArgs {
  prompt: string;
  characterAsset: Asset;
  aspectRatio: string;
}

export function useKeyframeGeneration({
  prompt,
  characterAsset,
  aspectRatio,
}: UseKeyframeGenerationArgs) {
  const [keyframes, setKeyframes] = useState<KeyframeOption[]>([]);
  const [selectedKeyframe, setSelectedKeyframe] = useState<KeyframeOption | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setKeyframes([]);
    setSelectedKeyframe(null);
    setError(null);
  }, [prompt, characterAsset.id, aspectRatio]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const generateKeyframes = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || !characterAsset?.id) {
      abortRef.current?.abort();
      setIsGenerating(false);
      setKeyframes([]);
      setSelectedKeyframe(null);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setKeyframes([]);
    setSelectedKeyframe(null);

    try {
      const response = await fetch('/api/generate/consistent/keyframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          characterId: characterAsset.id,
          prompt: trimmedPrompt,
          aspectRatio,
          count: 3,
        }),
      });

      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        throw new Error('Failed to generate keyframes');
      }

      const result = await response.json();
      if (requestId !== requestIdRef.current) return;
      const options = Array.isArray(result) ? result : [result];
      setKeyframes(options);
      setSelectedKeyframe(null);
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to generate keyframes');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }, [aspectRatio, characterAsset.id, prompt]);

  const selectKeyframe = useCallback((keyframe: KeyframeOption) => {
    setSelectedKeyframe(keyframe);
  }, []);

  const regenerate = useCallback(async () => {
    setSelectedKeyframe(null);
    await generateKeyframes();
  }, [generateKeyframes]);

  return {
    keyframes,
    selectedKeyframe,
    isGenerating,
    error,
    generateKeyframes,
    selectKeyframe,
    regenerate,
  };
}

export default useKeyframeGeneration;
