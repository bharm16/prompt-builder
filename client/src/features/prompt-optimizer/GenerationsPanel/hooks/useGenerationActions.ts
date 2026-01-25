import { useCallback, useEffect, useRef } from 'react';

import type { Generation, GenerationParams } from '../types';
import type { GenerationsAction } from './useGenerationsState';
import { compileWanPrompt, generateStoryboardPreview, generateVideoPreview, waitForVideoJob } from '../api';
import { buildGeneration, resolveGenerationOptions } from '../utils/generationUtils';

interface UseGenerationActionsOptions {
  aspectRatio?: string;
  duration?: number;
  fps?: number;
  generationParams?: Record<string, unknown>;
  promptVersionId?: string | null;
  generations?: Generation[];
}

interface StoryboardParams extends GenerationParams {
  seedImageUrl?: string | null;
}

export function useGenerationActions(
  dispatch: React.Dispatch<GenerationsAction>,
  options: UseGenerationActionsOptions = {}
) {
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());
  const generationsRef = useRef<Generation[]>(options.generations ?? []);
  const promptVersionRef = useRef<string | null>(options.promptVersionId ?? null);
  // Bug 9 fix: ref for options to avoid callback churn
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    generationsRef.current = options.generations ?? [];
  }, [options.generations]);

  const markGenerationCancelled = useCallback(
    (id: string, reason: string) => {
      dispatch({
        type: 'UPDATE_GENERATION',
        payload: { id, updates: { status: 'failed', error: reason, completedAt: Date.now() } },
      });
      inFlightRef.current.delete(id);
    },
    [dispatch]
  );

  const abortAll = useCallback(() => {
    inFlightRef.current.forEach((controller) => controller.abort());
    inFlightRef.current.clear();
  }, []);

  const abortMismatched = useCallback(
    (nextPromptVersionId: string | null) => {
      const entries = Array.from(inFlightRef.current.entries());
      for (const [id, controller] of entries) {
        const generation = generationsRef.current.find((item) => item.id === id);
        const generationVersionId = generation?.promptVersionId ?? null;
        if (!generation || generationVersionId !== nextPromptVersionId) {
          controller.abort();
          if (generation && (generation.status === 'generating' || generation.status === 'pending')) {
            markGenerationCancelled(id, 'Prompt version changed');
          } else {
            inFlightRef.current.delete(id);
          }
        }
      }
    },
    [markGenerationCancelled]
  );

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

  // Bug 9 fix: read options from ref to avoid callback recreation on every options change
  const generateDraft = useCallback(
    async (model: 'flux-kontext' | 'wan-2.2', prompt: string, params: GenerationParams) => {
      const resolved = resolveGenerationOptions(optionsRef.current, params);
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
            throw new Error(response.message || response.error || 'Failed to generate frames');
          }
          const urls = response.data.imageUrls;
          const storagePaths = response.data.storagePaths;
          finalizeGeneration(generation.id, {
            status: 'completed',
            completedAt: Date.now(),
            mediaUrls: urls,
            ...(storagePaths?.length ? { mediaAssetIds: storagePaths } : {}),
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

        let videoUrl: string | null = null;
        if (response.success && response.videoUrl) {
          videoUrl = response.videoUrl;
        } else if (response.success && response.jobId) {
          videoUrl = await waitForVideoJob(response.jobId, controller.signal);
        }

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
    [dispatch, finalizeGeneration]
  );

  const generateStoryboard = useCallback(
    async (prompt: string, params: StoryboardParams) => {
      const { seedImageUrl, ...baseParams } = params;
      const resolved = resolveGenerationOptions(optionsRef.current, baseParams);
      const generation = buildGeneration('draft', 'flux-kontext', prompt, resolved);
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        const response = await generateStoryboardPreview(prompt, {
          ...(resolved.aspectRatio ? { aspectRatio: resolved.aspectRatio } : {}),
          ...(seedImageUrl ? { seedImageUrl } : {}),
        });
        if (controller.signal.aborted) return;
        if (!response.success || !response.data?.imageUrls?.length) {
          throw new Error(response.message || response.error || 'Failed to generate storyboard');
        }
        const urls = response.data.imageUrls;
        const storagePaths = response.data.storagePaths;
        const finalizationPayload = {
          status: 'completed' as const,
          completedAt: Date.now(),
          mediaUrls: urls,
          ...(storagePaths?.length ? { mediaAssetIds: storagePaths } : {}),
          thumbnailUrl: response.data.baseImageUrl || urls[0] || null,
        };
        finalizeGeneration(generation.id, finalizationPayload);
      } catch (error) {
        if (controller.signal.aborted) return;
        finalizeGeneration(generation.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Storyboard failed',
        });
      }
    },
    [dispatch, finalizeGeneration]
  );

  const generateRender = useCallback(
    async (model: string, prompt: string, params: GenerationParams) => {
      const resolved = resolveGenerationOptions(optionsRef.current, params);
      const generation = buildGeneration('render', model, prompt, resolved);
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        const isCharacterAsset =
          resolved.startImage?.source === 'asset' && Boolean(resolved.startImage?.assetId);
        const response = await generateVideoPreview(prompt, resolved.aspectRatio ?? undefined, model, {
          ...(!isCharacterAsset && resolved.startImage?.url
            ? { startImage: resolved.startImage.url }
            : {}),
          ...(isCharacterAsset ? { characterAssetId: resolved.startImage?.assetId } : {}),
          ...(resolved.generationParams ? { generationParams: resolved.generationParams } : {}),
        });
        if (controller.signal.aborted) return;

        let videoUrl: string | null = null;
        if (response.success && response.videoUrl) {
          videoUrl = response.videoUrl;
        } else if (response.success && response.jobId) {
          videoUrl = await waitForVideoJob(response.jobId, controller.signal);
        }

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
    [dispatch, finalizeGeneration]
  );

  const cancelGeneration = useCallback(
    (id: string) => {
      const controller = inFlightRef.current.get(id);
      if (controller) controller.abort();
      markGenerationCancelled(id, 'Cancelled');
    },
    [markGenerationCancelled]
  );

  const retryGeneration = useCallback(
    (id: string) => {
      const generation = generationsRef.current.find((item) => item.id === id);
      if (!generation) return;
      const opts = optionsRef.current;
      const params: GenerationParams = {
        promptVersionId: generation.promptVersionId ?? opts.promptVersionId ?? null,
        aspectRatio: generation.aspectRatio ?? opts.aspectRatio ?? null,
        duration: generation.duration ?? opts.duration ?? null,
        fps: generation.fps ?? opts.fps ?? null,
        generationParams: opts.generationParams,
      };
      if (generation.tier === 'draft') {
        generateDraft(generation.model as 'flux-kontext' | 'wan-2.2', generation.prompt, params);
        return;
      }
      generateRender(generation.model, generation.prompt, params);
    },
    [generateDraft, generateRender]
  );

  return { generateDraft, generateRender, generateStoryboard, cancelGeneration, retryGeneration };
}
