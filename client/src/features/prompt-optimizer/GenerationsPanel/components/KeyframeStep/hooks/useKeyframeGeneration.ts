import { useCallback, useState } from 'react';
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

  const generateKeyframes = useCallback(async () => {
    if (!prompt.trim() || !characterAsset?.id) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate/consistent/keyframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          characterId: characterAsset.id,
          prompt,
          aspectRatio,
          count: 3,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate keyframes');
      }

      const result = await response.json();
      const options = Array.isArray(result) ? result : [result];
      setKeyframes(options);
      setSelectedKeyframe(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keyframes');
    } finally {
      setIsGenerating(false);
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
