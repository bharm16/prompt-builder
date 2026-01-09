/**
 * useVideoPreview Hook
 *
 * Manages video preview state and generation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { promptOptimizationApiV2 } from '@/services';
import { generateVideoPreview, getVideoPreviewStatus } from '../api/previewApi';

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

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 6 * 60 * 1000;

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
        const options = (() => {
          const payload: {
            startImage?: string;
            inputReference?: string;
            generationParams?: Record<string, unknown>;
          } = {};
          if (startImage) payload.startImage = startImage;
          if (inputReference) payload.inputReference = inputReference;
          if (generationParams) payload.generationParams = generationParams;
          return Object.keys(payload).length ? payload : undefined;
        })();
        let wanPrompt = promptToGenerate;
        try {
          const compiled = await promptOptimizationApiV2.compilePrompt({
            prompt: promptToGenerate,
            targetModel: 'wan',
            signal: abortController.signal,
          });

          if (abortController.signal.aborted) {
            return;
          }

          if (compiled?.compiledPrompt && typeof compiled.compiledPrompt === 'string') {
            const trimmed = compiled.compiledPrompt.trim();
            if (trimmed) {
              wanPrompt = trimmed;
            }
          }
        } catch {
          if (abortController.signal.aborted) {
            return;
          }
        }

        const previewModel = 'wan-2.2';
        const response = await generateVideoPreview(wanPrompt, aspectRatio, previewModel, options);

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (response.success && response.videoUrl) {
          setVideoUrl(response.videoUrl);
          setError(null);
          return;
        }

        if (response.success && response.jobId) {
          const resultUrl = await waitForVideoJob(response.jobId, abortController.signal);
          if (!resultUrl || abortController.signal.aborted) {
            return;
          }
          setVideoUrl(resultUrl);
          setError(null);
          return;
        }

        throw new Error(response.error || response.message || 'Failed to generate video preview');
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

async function waitForVideoJob(jobId: string, signal: AbortSignal): Promise<string | null> {
  const startTime = Date.now();

  while (true) {
    if (signal.aborted) {
      return null;
    }

    const status = await getVideoPreviewStatus(jobId);

    if (signal.aborted) {
      return null;
    }

    if (!status.success) {
      throw new Error(status.error || status.message || 'Failed to fetch video job status');
    }

    if (status.status === 'completed' && status.videoUrl) {
      return status.videoUrl;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Video generation failed');
    }

    if (Date.now() - startTime > MAX_WAIT_MS) {
      throw new Error('Timed out waiting for video preview');
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, POLL_INTERVAL_MS);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  }
}
