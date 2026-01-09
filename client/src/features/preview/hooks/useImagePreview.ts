/**
 * useImagePreview Hook
 *
 * Manages image preview state and generation.
 * Handles debouncing to prevent excessive API calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { generatePreview } from '../api/previewApi';

interface UseImagePreviewOptions {
  prompt: string;
  isVisible: boolean;
  debounceMs?: number;
  aspectRatio?: string;
}

interface UseImagePreviewReturn {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  regenerate: () => void;
}

/**
 * Hook for managing image preview state
 *
 * @param options - Hook options
 * @returns Preview state and controls
 */
export function useImagePreview({
  prompt,
  isVisible,
  debounceMs = 1000,
  aspectRatio,
}: UseImagePreviewOptions): UseImagePreviewReturn {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>('');

  useEffect(() => {
    setImageUrl(null);
    setError(null);
    setLoading(false);
    lastPromptRef.current = '';
  }, [prompt, aspectRatio]);

  /**
   * Generate preview image
   */
  const generateImage = useCallback(
    async (promptToGenerate: string, isManual = false) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Don't generate if prompt is empty
      if (!promptToGenerate || promptToGenerate.trim().length === 0) {
        setImageUrl(null);
        setError(null);
        setLoading(false);
        return;
      }

      // Skip if prompt hasn't changed and it's not a manual regeneration
      if (!isManual && promptToGenerate === lastPromptRef.current && imageUrl) {
        return;
      }

      setLoading(true);
      setError(null);
      lastPromptRef.current = promptToGenerate;

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await generatePreview(promptToGenerate, aspectRatio);

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (response.success && response.data?.imageUrl) {
          setImageUrl(response.data.imageUrl);
          setError(null);
        } else {
          throw new Error(response.error || response.message || 'Failed to generate preview');
        }
      } catch (err) {
        // Don't set error if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate preview image';
        setError(errorMessage);
        setImageUrl(null);
      } finally {
        // Only update loading state if this request wasn't aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [aspectRatio, imageUrl]
  );

  /**
   * Manual regeneration trigger
   */
  const regenerate = useCallback(() => {
    if (prompt && prompt.trim().length > 0) {
      generateImage(prompt, true);
    }
  }, [prompt, generateImage]);

  /**
   * Effect: Clear image when prompt becomes empty or visibility changes
   * (Automatic generation disabled - use regenerate button instead)
   */
  useEffect(() => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Don't generate if not visible - clear state
    if (!isVisible) {
      setLoading(false);
      return;
    }

    // Clear image if prompt is empty
    if (!prompt || prompt.trim().length === 0) {
      setImageUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    // No automatic generation - user must click regenerate button
  }, [prompt, isVisible]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    imageUrl,
    loading,
    error,
    regenerate,
  };
}
