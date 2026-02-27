/**
 * useVideoPreview Hook
 *
 * Manages video preview state and generation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { promptOptimizationApiV2 } from '@/services';
import { generateVideoPreview, getVideoPreviewStatus } from '../api/previewApi';
import { VIDEO_DRAFT_MODEL } from '@/components/ToolSidebar/config/modelConfig';

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
const COMPILE_TIMEOUT_MS = 4000;

const stripVideoPreviewPrompt = (prompt: string): string => {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return trimmed;
  }

  const markers: RegExp[] = [
    /\r?\n\s*\*\*\s*technical specs\s*\*\*/i,
    /\r?\n\s*\*\*\s*technical parameters\s*\*\*/i,
    /\r?\n\s*\*\*\s*alternative approaches\s*\*\*/i,
    /\r?\n\s*technical specs\s*[:\n]/i,
    /\r?\n\s*alternative approaches\s*[:\n]/i,
    /\r?\n\s*variation\s+\d+/i,
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const match = marker.exec(trimmed);
    if (match && (cutIndex === -1 || match.index < cutIndex)) {
      cutIndex = match.index;
    }
  }

  let cleaned = (cutIndex >= 0 ? trimmed.slice(0, cutIndex) : trimmed).trim();
  cleaned = cleaned
    .replace(/^\s*\*\*\s*prompt\s*:\s*\*\*/i, '')
    .replace(/^\s*prompt\s*:\s*/i, '')
    .trim();

  if (cleaned.length < 10) {
    return trimmed;
  }

  return cleaned;
};

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

  useEffect(() => {
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    lastPromptRef.current = '';
  }, [prompt, aspectRatio, inputReference, startImage]);

  /**
   * Generate preview video
   */
  const generateVideo = useCallback(
    async (promptToGenerate: string, isManual = false) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const cleanedPrompt = stripVideoPreviewPrompt(promptToGenerate);

      // Don't generate if prompt is empty
      if (!cleanedPrompt || cleanedPrompt.trim().length === 0) {
        setVideoUrl(null);
        setError(null);
        setLoading(false);
        return;
      }

      // Skip if prompt hasn't changed and it's not a manual regeneration
      if (!isManual && cleanedPrompt === lastPromptRef.current && videoUrl) {
        return;
      }

      setLoading(true);
      setError(null);
      lastPromptRef.current = cleanedPrompt;

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const resolvedModel = model && model.trim().length > 0 ? model.trim() : VIDEO_DRAFT_MODEL.id;
        const normalizedModel = resolvedModel.toLowerCase();
        const isWanModel = normalizedModel.includes('wan');
        const isSoraModel = normalizedModel.includes('sora');
        const resolvedInputReference = inputReference || (isSoraModel ? startImage : undefined);

        const options = (() => {
          const payload: {
            startImage?: string;
            inputReference?: string;
            generationParams?: Record<string, unknown>;
          } = {};
          if (startImage) payload.startImage = startImage;
          if (resolvedInputReference) payload.inputReference = resolvedInputReference;
          if (generationParams) payload.generationParams = generationParams;
          return Object.keys(payload).length ? payload : undefined;
        })();

        let resolvedPrompt = cleanedPrompt;
        if (isWanModel) {
          try {
            const compileAbortController = new AbortController();
            const abortCompile = () => compileAbortController.abort();
            const timeoutId = window.setTimeout(() => {
              compileAbortController.abort();
            }, COMPILE_TIMEOUT_MS);

            abortController.signal.addEventListener('abort', abortCompile, { once: true });
            try {
              const compiled = await promptOptimizationApiV2.compilePrompt({
                prompt: cleanedPrompt,
                targetModel: 'wan',
                signal: compileAbortController.signal,
              });

              if (!compileAbortController.signal.aborted) {
                if (compiled?.compiledPrompt && typeof compiled.compiledPrompt === 'string') {
                  const trimmed = compiled.compiledPrompt.trim();
                  if (trimmed) {
                    resolvedPrompt = trimmed;
                  }
                }
              }
            } finally {
              window.clearTimeout(timeoutId);
              abortController.signal.removeEventListener('abort', abortCompile);
            }
          } catch {
            // Best-effort compile; fallback to cleaned prompt on errors/timeouts.
          }
        }

        if (abortController.signal.aborted) {
          return;
        }

        const response = await generateVideoPreview(resolvedPrompt, aspectRatio, resolvedModel, options);

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
  let adaptiveTimeoutMs = MAX_WAIT_MS;

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

    // Adapt timeout based on server-reported single-attempt budget
    if (status.serverTimeoutMs) {
      adaptiveTimeoutMs = Math.max(
        Math.ceil(status.serverTimeoutMs * 1.2),
        MAX_WAIT_MS
      );
    }

    if (status.status === 'completed' && status.videoUrl) {
      return status.videoUrl;
    }

    if (status.status === 'completed') {
      throw new Error('Video preview completed but no URL was returned');
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Video generation failed');
    }

    if (Date.now() - startTime > adaptiveTimeoutMs) {
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
