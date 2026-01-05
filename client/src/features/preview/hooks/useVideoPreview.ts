/**
 * useVideoPreview Hook
 *
 * Manages video preview state and generation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { generateVideoPreview } from '../api/previewApi';

interface UseVideoPreviewOptions {
  prompt: string;
  isVisible: boolean;
  aspectRatio?: string;
  model?: string;
  startImage?: string;
  inputReference?: string;
  generationParams?: Record<string, unknown>;
}

interface UseVideoPreviewReturn {
  videoUrl: string | null;
  loading: boolean;
  error: string | null;
  regenerate: () => void;
}

/**
 * Hook for managing video preview state
 */
export function useVideoPreview({
  prompt,
  isVisible,
  aspectRatio,
  model,
  startImage,
  inputReference,
  generationParams,
}: UseVideoPreviewOptions): UseVideoPreviewReturn {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>('');

  /**
   * Generate preview video
   */
  const generateVideo = useCallback(
    async (promptToGenerate: string, isManual = false) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Don't generate if prompt is empty
      if (!promptToGenerate || promptToGenerate.trim().length === 0) {
        setVideoUrl(null);
        setError(null);
        setLoading(false);
        return;
      }

      // Skip if prompt hasn't changed and it's not a manual regeneration
      if (!isManual && promptToGenerate === lastPromptRef.current && videoUrl) {
        return;
      }

      setLoading(true);
      setError(null);
      lastPromptRef.current = promptToGenerate;

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await generateVideoPreview(promptToGenerate, aspectRatio, model, {
          startImage,
          inputReference,
          generationParams,
        });

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (response.success && response.videoUrl) {
          setVideoUrl(response.videoUrl);
          setError(null);
        } else {
          throw new Error(response.error || response.message || 'Failed to generate video preview');
        }
      } catch (err) {
        // Don't set error if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate video preview';
        setError(errorMessage);
        setVideoUrl(null);
      } finally {
        // Only update loading state if this request wasn't aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [aspectRatio, model, videoUrl, startImage, inputReference, generationParams]
  );

  /**
   * Manual regeneration trigger
   */
  const regenerate = useCallback(() => {
    if (prompt && prompt.trim().length > 0) {
      generateVideo(prompt, true);
    }
  }, [prompt, generateVideo]);

  /**
   * Effect: Clear video when prompt becomes empty or visibility changes
   */
  useEffect(() => {
    if (!isVisible) {
      setLoading(false);
      return;
    }

    if (!prompt || prompt.trim().length === 0) {
      setVideoUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
  }, [prompt, isVisible]);

  useEffect(() => {
    if (!model) {
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    lastPromptRef.current = '';
  }, [model]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    videoUrl,
    loading,
    error,
    regenerate,
  };
}
