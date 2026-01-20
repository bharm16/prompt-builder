import { useCallback, useEffect, useRef } from 'react';
import { generateStoryboardPreview, generateVideoPreview } from '@/features/preview/api/previewApi';
import type { Generation, GenerationParams } from '../types';
import type { GenerationsAction } from './useGenerationsState';
import { buildGeneration, compileWanPrompt, resolveGenerationOptions, waitForVideoJob } from './generationActionUtils';

interface UseGenerationActionsOptions {
  aspectRatio?: string;
  duration?: number;
  fps?: number;
  generationParams?: Record<string, unknown>;
  promptVersionId?: string | null;
  generations?: Generation[];
}

export function useGenerationActions(
  dispatch: React.Dispatch<GenerationsAction>,
  options: UseGenerationActionsOptions = {}
) {
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());
  const generationsRef = useRef<Generation[]>(options.generations ?? []);
  const promptVersionRef = useRef<string | null>(options.promptVersionId ?? null);

  useEffect(() => {
    generationsRef.current = options.generations ?? [];
  }, [options.generations]);

  const abortAll = useCallback(() => {
    inFlightRef.current.forEach((controller) => controller.abort());
    inFlightRef.current.clear();
  }, []);

  const abortMismatched = useCallback((nextPromptVersionId: string | null) => {
    const entries = Array.from(inFlightRef.current.entries());
    for (const [id, controller] of entries) {
      const generation = generationsRef.current.find((item) => item.id === id);
      const generationVersionId = generation?.promptVersionId ?? null;
      if (!generation || generationVersionId !== nextPromptVersionId) {
        controller.abort();
        inFlightRef.current.delete(id);
      }
    }
  }, []);

  useEffect(() => {
    const nextPromptVersionId = options.promptVersionId ?? null;
    if (promptVersionRef.current === nextPromptVersionId) return;
    abortMismatched(nextPromptVersionId);
    promptVersionRef.current = nextPromptVersionId;
  }, [abortMismatched, options.promptVersionId]);

  useEffect(() => () => abortAll(), [abortAll]);

  const finalizeGeneration = useCallback(
    (id: string, updates: Partial<Generation>) => {
      dispatch({ type: 'UPDATE_GENERATION', payload: { id, updates } });
      inFlightRef.current.delete(id);
    },
    [dispatch]
  );

  const generateDraft = useCallback(
    async (model: 'flux-kontext' | 'wan-2.2', prompt: string, params: GenerationParams) => {
      const resolved = resolveGenerationOptions(options, params);
      const generation = buildGeneration('draft', model, prompt, resolved);
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        if (model === 'flux-kontext') {
          const response = await generateStoryboardPreview(prompt, {
            ...(resolved.aspectRatio ? { aspectRatio: resolved.aspectRatio } : {}),
          });
          if (controller.signal.aborted) return;
          if (!response.success || !response.data?.imageUrls?.length) {
            throw new Error(response.error || response.message || 'Failed to generate frames');
          }
          const urls = response.data.imageUrls;
          finalizeGeneration(generation.id, {
            status: 'completed',
            completedAt: Date.now(),
            mediaUrls: urls,
            thumbnailUrl: response.data.baseImageUrl || urls[0] || null,
          });
          return;
        }

        let wanPrompt = prompt.trim();
        try {
          wanPrompt = await compileWanPrompt(prompt, controller.signal);
        } catch {
          wanPrompt = prompt.trim();
        }
        if (controller.signal.aborted) return;

        const response = await generateVideoPreview(wanPrompt, resolved.aspectRatio ?? undefined, model, {
          ...(resolved.generationParams ? { generationParams: resolved.generationParams } : {}),
        });
        if (controller.signal.aborted) return;

        const videoUrl =
          response.success && response.videoUrl
            ? response.videoUrl
            : response.success && response.jobId
              ? await waitForVideoJob(response.jobId, controller.signal)
              : null;

        if (controller.signal.aborted) return;
        if (!videoUrl) {
          throw new Error(response.error || response.message || 'Failed to generate video');
        }
        finalizeGeneration(generation.id, {
          status: 'completed',
          completedAt: Date.now(),
          mediaUrls: [videoUrl],
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        finalizeGeneration(generation.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Generation failed',
        });
      }
    },
    [dispatch, finalizeGeneration, options]
  );

  const generateRender = useCallback(
    async (model: string, prompt: string, params: GenerationParams) => {
      const resolved = resolveGenerationOptions(options, params);
      const generation = buildGeneration('render', model, prompt, resolved);
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        const response = await generateVideoPreview(prompt, resolved.aspectRatio ?? undefined, model, {
          ...(resolved.generationParams ? { generationParams: resolved.generationParams } : {}),
        });
        if (controller.signal.aborted) return;
        const videoUrl =
          response.success && response.videoUrl
            ? response.videoUrl
            : response.success && response.jobId
              ? await waitForVideoJob(response.jobId, controller.signal)
              : null;
        if (controller.signal.aborted) return;
        if (!videoUrl) {
          throw new Error(response.error || response.message || 'Failed to render video');
        }
        finalizeGeneration(generation.id, {
          status: 'completed',
          completedAt: Date.now(),
          mediaUrls: [videoUrl],
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        finalizeGeneration(generation.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Render failed',
        });
      }
    },
    [dispatch, finalizeGeneration, options]
  );

  const cancelGeneration = useCallback(
    (id: string) => {
      const controller = inFlightRef.current.get(id);
      if (controller) controller.abort();
      inFlightRef.current.delete(id);
      dispatch({
        type: 'UPDATE_GENERATION',
        payload: { id, updates: { status: 'failed', error: 'Cancelled', completedAt: Date.now() } },
      });
    },
    [dispatch]
  );

  const retryGeneration = useCallback(
    (id: string) => {
      const generation = generationsRef.current.find((item) => item.id === id);
      if (!generation) return;
      const params: GenerationParams = {
        promptVersionId: generation.promptVersionId ?? options.promptVersionId ?? null,
        aspectRatio: generation.aspectRatio ?? options.aspectRatio ?? null,
        duration: generation.duration ?? options.duration ?? null,
        fps: generation.fps ?? options.fps ?? null,
        generationParams: options.generationParams,
      };
      if (generation.tier === 'draft') {
        generateDraft(generation.model as 'flux-kontext' | 'wan-2.2', generation.prompt, params);
        return;
      }
      generateRender(generation.model, generation.prompt, params);
    },
    [generateDraft, generateRender, options]
  );

  return { generateDraft, generateRender, cancelGeneration, retryGeneration };
}
