import { useCallback, useEffect, useRef } from 'react';

import type { Generation, GenerationParams } from '../types';
import type { DraftModel } from '@components/ToolSidebar/types';
import type { GenerationsAction } from './useGenerationsState';
import { compileWanPrompt, generateStoryboardPreview, generateVideoPreview, waitForVideoJob } from '../api';
import { buildGeneration, resolveGenerationOptions } from '../utils/generationUtils';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';
import { assetApi } from '@/features/assets/api/assetApi';
import { safeUrlHost } from '@/utils/url';
import { ApiError } from '@/services/http/ApiError';
import {
  extractStorageObjectPath,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from '@/utils/storageUrl';
import { getModelConfig } from '../config/generationConfig';

interface UseGenerationActionsOptions {
  aspectRatio?: string | undefined;
  duration?: number | undefined;
  fps?: number | undefined;
  generationParams?: Record<string, unknown> | undefined;
  promptVersionId?: string | null | undefined;
  generations?: Generation[] | undefined;
  onInsufficientCredits?: ((required: number, operation: string) => void) | undefined;
}

interface StoryboardParams extends GenerationParams {
  seedImageUrl?: string | null | undefined;
}

const log = logger.child('useGenerationActions');
const TRIGGER_REGEX = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;

const normalizeMotionString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractMotionMeta = (generationParams?: Record<string, unknown>) => {
  const params = generationParams ?? {};
  const generationParamKeys = Object.keys(params);
  const cameraMotionId = normalizeMotionString(params.camera_motion_id);
  const subjectMotion = normalizeMotionString(params.subject_motion);
  const keyframesCount = Array.isArray(params.keyframes) ? params.keyframes.length : 0;

  return {
    hasGenerationParams: generationParamKeys.length > 0,
    generationParamKeys,
    hasCameraMotion: Boolean(cameraMotionId),
    cameraMotionId,
    hasSubjectMotion: Boolean(subjectMotion),
    subjectMotionLength: subjectMotion?.length ?? 0,
    hasKeyframes: keyframesCount > 0,
    keyframesCount,
  } as const;
};

const extractFaceSwapMeta = (params?: GenerationParams) => {
  const resolvedFaceSwapUrl =
    params?.faceSwapUrl ?? (params?.faceSwapAlreadyApplied ? params.startImage?.url ?? null : null);
  return {
    faceSwapUrl: resolvedFaceSwapUrl,
    faceSwapApplied: Boolean(resolvedFaceSwapUrl),
    characterAssetId: params?.characterAssetId ?? null,
  } as const;
};

const hasPromptTriggers = (prompt: string): boolean =>
  Array.from(prompt.matchAll(TRIGGER_REGEX)).length > 0;

const START_IMAGE_REFRESH_BUFFER_MS = 2 * 60 * 1000;

const parseExpiresAtMs = (value?: string | null): number | null => {
  if (!value || typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const shouldRefreshStartImage = (url: string | null, expiresAtMs: number | null): boolean => {
  if (!url || typeof url !== 'string') return true;
  if (expiresAtMs !== null) {
    return Date.now() >= expiresAtMs - START_IMAGE_REFRESH_BUFFER_MS;
  }
  return hasGcsSignedUrlParams(url);
};

const isInsufficientCreditsError = (error: unknown): error is ApiError => {
  if (!(error instanceof ApiError) || error.status !== 402) {
    return false;
  }
  if (!error.response || typeof error.response !== 'object') {
    return false;
  }
  if (!('code' in error.response)) {
    return false;
  }
  return (error.response as { code?: unknown }).code === 'INSUFFICIENT_CREDITS';
};

const resolveStartImageUrl = async (
  startImage: GenerationParams['startImage']
): Promise<GenerationParams['startImage']> => {
  if (!startImage || typeof startImage.url !== 'string') {
    return startImage;
  }

  const storagePath = startImage.storagePath || extractStorageObjectPath(startImage.url);
  if (!storagePath) {
    return startImage;
  }

  const expiresAtMs =
    parseExpiresAtMs(startImage.viewUrlExpiresAt) ?? parseGcsSignedUrlExpiryMs(startImage.url);
  const needsRefresh = shouldRefreshStartImage(startImage.url, expiresAtMs);
  if (!needsRefresh) {
    return {
      ...startImage,
      storagePath,
    };
  }

  const resolved = await resolveMediaUrl({
    kind: 'image',
    url: startImage.url,
    storagePath,
    preferFresh: true,
  });
  if (!resolved.url) return { ...startImage, storagePath };
  return {
    ...startImage,
    url: resolved.url,
    storagePath,
    ...(resolved.expiresAt ? { viewUrlExpiresAt: resolved.expiresAt } : {}),
  };
};

const resolveSeedImageUrl = async (seedImageUrl: string | null | undefined): Promise<string | null> => {
  if (!seedImageUrl || typeof seedImageUrl !== 'string') return seedImageUrl ?? null;
  const storagePath = extractStorageObjectPath(seedImageUrl);
  if (!storagePath) return seedImageUrl;
  const expiresAtMs = parseGcsSignedUrlExpiryMs(seedImageUrl);
  const needsRefresh = shouldRefreshStartImage(seedImageUrl, expiresAtMs);
  if (!needsRefresh) return seedImageUrl;
  const resolved = await resolveMediaUrl({
    kind: 'image',
    url: seedImageUrl,
    storagePath,
    preferFresh: true,
  });
  return resolved.url ?? seedImageUrl;
};

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
      log.info('Generation marked as cancelled', {
        generationId: id,
        reason,
        inFlightCount: inFlightRef.current.size,
      });
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
    async (model: DraftModel, prompt: string, params: GenerationParams) => {
      const resolved = resolveGenerationOptions(optionsRef.current, params);
      const generation = buildGeneration('draft', model, prompt, resolved);
      const modelConfig = getModelConfig(model);
      const requiredCredits = modelConfig?.credits ?? 0;
      const operationLabel = `${modelConfig?.label ?? 'Video'} preview`;
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });
      const startedAt = Date.now();
      const motionMeta = extractMotionMeta(resolved.generationParams);
      const faceSwapMeta = extractFaceSwapMeta(resolved);
      const startImageUrlHost = resolved.startImage?.url ? safeUrlHost(resolved.startImage.url) : null;

      log.info('Draft generation started', {
        generationId: generation.id,
        tier: 'draft',
        model,
        promptLength: prompt.trim().length,
        aspectRatio: resolved.aspectRatio ?? null,
        hasStartImage: Boolean(resolved.startImage),
        startImageUrlHost,
        faceSwapApplied: faceSwapMeta.faceSwapApplied,
        faceSwapUrlHost: faceSwapMeta.faceSwapUrl ? safeUrlHost(faceSwapMeta.faceSwapUrl) : null,
        characterAssetId: faceSwapMeta.characterAssetId,
        ...motionMeta,
      });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        if (model === 'flux-kontext') {
          const response = await generateStoryboardPreview(prompt, {
            ...(resolved.aspectRatio ? { aspectRatio: resolved.aspectRatio } : {}),
          });
          if (controller.signal.aborted) return;
          if (!response.success || !response.data?.imageUrls?.length) {
            log.warn('Storyboard draft response invalid', {
              generationId: generation.id,
              success: response.success,
              hasImageUrls: Boolean(response.data?.imageUrls?.length),
              error: response.message || response.error || 'Failed to generate frames',
              ...motionMeta,
            });
            throw new Error(response.message || response.error || 'Failed to generate frames');
          }
          const urls = response.data.imageUrls;
          const storagePaths = response.data.storagePaths;
          const durationMs = Date.now() - startedAt;

          log.info('Storyboard draft generation succeeded', {
            generationId: generation.id,
            durationMs,
            framesCount: urls.length,
            ...motionMeta,
          });
          finalizeGeneration(generation.id, {
            status: 'completed',
            completedAt: Date.now(),
            mediaUrls: urls,
            ...(storagePaths?.length ? { mediaAssetIds: storagePaths } : {}),
            thumbnailUrl: response.data.baseImageUrl || urls[0] || null,
          });
          return;
        }

        let promptForCompilation = prompt.trim();
        let resolvedCharacterAssetId = resolved.characterAssetId?.trim() || null;

        if (hasPromptTriggers(promptForCompilation)) {
          try {
            const resolvedPrompt = await assetApi.resolve(promptForCompilation);
            const expandedPrompt = resolvedPrompt.expandedText.trim();
            if (expandedPrompt.length > 0) {
              promptForCompilation = expandedPrompt;
            }
            if (!resolvedCharacterAssetId) {
              resolvedCharacterAssetId = resolvedPrompt.characters[0]?.id ?? null;
            }
          } catch (error) {
            const info = sanitizeError(error);
            log.warn('Prompt trigger resolution failed; falling back to raw prompt', {
              generationId: generation.id,
              error: info.message,
              errorName: info.name,
            });
          }
        }
        if (controller.signal.aborted) return;

        let wanPrompt = promptForCompilation;
        try {
          wanPrompt = await compileWanPrompt(promptForCompilation, controller.signal);
        } catch (error) {
          const info = sanitizeError(error);
          log.warn('WAN prompt compilation failed; using raw prompt', {
            generationId: generation.id,
            error: info.message,
            errorName: info.name,
          });
          wanPrompt = promptForCompilation;
        }
        if (controller.signal.aborted) return;
        const motionPromptInjected = false;

        const resolvedStartImage = resolved.startImage
          ? await resolveStartImageUrl(resolved.startImage)
          : null;
        if (controller.signal.aborted) return;
        const requestStartImageUrlHost = resolvedStartImage?.url
          ? safeUrlHost(resolvedStartImage.url)
          : startImageUrlHost;

        log.info('Video draft request dispatched', {
          generationId: generation.id,
          model,
          promptLength: wanPrompt.length,
          aspectRatio: resolved.aspectRatio ?? null,
          hasStartImage: Boolean(resolvedStartImage?.url),
          startImageUrlHost: requestStartImageUrlHost,
          motionPromptInjected,
          faceSwapApplied: faceSwapMeta.faceSwapApplied,
          faceSwapUrlHost: faceSwapMeta.faceSwapUrl ? safeUrlHost(faceSwapMeta.faceSwapUrl) : null,
          characterAssetId: resolvedCharacterAssetId,
          ...motionMeta,
        });
        const response = await generateVideoPreview(wanPrompt, resolved.aspectRatio ?? undefined, model, {
          ...(resolvedStartImage?.url ? { startImage: resolvedStartImage.url } : {}),
          ...(resolved.generationParams ? { generationParams: resolved.generationParams } : {}),
          ...(resolvedCharacterAssetId ? { characterAssetId: resolvedCharacterAssetId } : {}),
          ...(resolved.faceSwapAlreadyApplied ? { faceSwapAlreadyApplied: true } : {}),
        });
        if (controller.signal.aborted) return;

        log.info('Video draft response received', {
          generationId: generation.id,
          success: response.success,
          hasVideoUrl: Boolean(response.videoUrl),
          hasJobId: Boolean(response.jobId),
          jobId: response.jobId ?? null,
          faceSwapApplied: response.faceSwapApplied ?? false,
          faceSwapUrlHost: response.faceSwapUrl ? safeUrlHost(response.faceSwapUrl) : null,
          ...motionMeta,
        });
        if (response.faceSwapApplied || response.faceSwapUrl) {
          dispatch({
            type: 'UPDATE_GENERATION',
            payload: {
              id: generation.id,
              updates: {
                faceSwapApplied: response.faceSwapApplied ?? true,
                faceSwapUrl: response.faceSwapUrl ?? generation.faceSwapUrl ?? null,
              },
            },
          });
        }
        let videoUrl: string | null = null;
        let videoStoragePath: string | null = response.storagePath ?? null;
        let videoAssetId: string | null = response.assetId ?? null;
        if (response.success && response.videoUrl) {
          videoUrl = response.videoUrl;
        } else if (response.success && response.jobId) {
          log.debug('Waiting for video draft job to complete', {
            generationId: generation.id,
            jobId: response.jobId,
          });
          const jobResult = await waitForVideoJob(response.jobId, controller.signal);
          videoUrl = jobResult?.videoUrl ?? null;
          videoStoragePath = jobResult?.storagePath ?? videoStoragePath;
          videoAssetId = jobResult?.assetId ?? videoAssetId;
          log.debug('Video draft job completed', {
            generationId: generation.id,
            jobId: response.jobId,
            hasVideoUrl: Boolean(videoUrl),
          });
        }

        if (controller.signal.aborted) return;
        if (!videoUrl) {
          log.warn('Video draft completed without a video URL', {
            generationId: generation.id,
            jobId: response.jobId ?? null,
            error: response.error || response.message || 'Failed to generate video',
            ...motionMeta,
          });
          throw new Error(response.error || response.message || 'Failed to generate video');
        }
        const durationMs = Date.now() - startedAt;
        log.info('Video draft generation succeeded', {
          generationId: generation.id,
          durationMs,
          faceSwapApplied: response?.faceSwapApplied ?? faceSwapMeta.faceSwapApplied,
          ...motionMeta,
        });
        finalizeGeneration(generation.id, {
          status: 'completed',
          completedAt: Date.now(),
          mediaUrls: [videoUrl],
          ...(videoAssetId
            ? { mediaAssetIds: [videoAssetId] }
            : videoStoragePath
              ? { mediaAssetIds: [videoStoragePath] }
              : {}),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isInsufficientCreditsError(error)) {
          dispatch({ type: 'REMOVE_GENERATION', payload: { id: generation.id } });
          inFlightRef.current.delete(generation.id);
          optionsRef.current.onInsufficientCredits?.(requiredCredits, operationLabel);
          return;
        }
        const durationMs = Date.now() - startedAt;
        const info = sanitizeError(error);
        const errObj = error instanceof Error ? error : new Error(info.message);

        log.error('Draft generation failed', errObj, {
          generationId: generation.id,
          model,
          durationMs,
          errorName: info.name,
          ...motionMeta,
        });
        finalizeGeneration(generation.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: errObj.message,
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
      const modelConfig = getModelConfig('flux-kontext');
      const requiredCredits = modelConfig?.credits ?? 4;
      const operationLabel = 'Storyboard';
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });
      const startedAt = Date.now();
      const motionMeta = extractMotionMeta(resolved.generationParams);

      log.info('Storyboard generation started', {
        generationId: generation.id,
        tier: 'draft',
        model: 'flux-kontext',
        promptLength: prompt.trim().length,
        aspectRatio: resolved.aspectRatio ?? null,
        hasSeedImageUrl: Boolean(seedImageUrl),
        ...motionMeta,
      });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        const resolvedSeedImageUrl = await resolveSeedImageUrl(seedImageUrl ?? null);
        const response = await generateStoryboardPreview(prompt, {
          ...(resolved.aspectRatio ? { aspectRatio: resolved.aspectRatio } : {}),
          ...(resolvedSeedImageUrl ? { seedImageUrl: resolvedSeedImageUrl } : {}),
        });
        if (controller.signal.aborted) return;
        if (!response.success || !response.data?.imageUrls?.length) {
          log.warn('Storyboard generation response invalid', {
            generationId: generation.id,
            success: response.success,
            hasImageUrls: Boolean(response.data?.imageUrls?.length),
            error: response.message || response.error || 'Failed to generate storyboard',
            ...motionMeta,
          });
          throw new Error(response.message || response.error || 'Failed to generate storyboard');
        }
        const urls = response.data.imageUrls;
        const storagePaths = response.data.storagePaths;
        const durationMs = Date.now() - startedAt;
        log.info('Storyboard generation succeeded', {
          generationId: generation.id,
          durationMs,
          framesCount: urls.length,
          ...motionMeta,
        });
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
        if (isInsufficientCreditsError(error)) {
          dispatch({ type: 'REMOVE_GENERATION', payload: { id: generation.id } });
          inFlightRef.current.delete(generation.id);
          optionsRef.current.onInsufficientCredits?.(requiredCredits, operationLabel);
          return;
        }
        const durationMs = Date.now() - startedAt;
        const info = sanitizeError(error);
        const errObj = error instanceof Error ? error : new Error(info.message);

        log.error('Storyboard generation failed', errObj, {
          generationId: generation.id,
          durationMs,
          errorName: info.name,
          ...motionMeta,
        });
        finalizeGeneration(generation.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: errObj.message,
        });
      }
    },
    [dispatch, finalizeGeneration]
  );

  const generateRender = useCallback(
    async (model: string, prompt: string, params: GenerationParams) => {
      const resolved = resolveGenerationOptions(optionsRef.current, params);
      const generation = buildGeneration('render', model, prompt, resolved);
      const modelConfig = getModelConfig(model);
      const requiredCredits = modelConfig?.credits ?? 0;
      const operationLabel = `${modelConfig?.label ?? 'Video'} render`;
      dispatch({ type: 'ADD_GENERATION', payload: generation });
      dispatch({ type: 'UPDATE_GENERATION', payload: { id: generation.id, updates: { status: 'generating' } } });
      const startedAt = Date.now();
      const motionMeta = extractMotionMeta(resolved.generationParams);
      const faceSwapMeta = extractFaceSwapMeta(resolved);
      const isCharacterAsset =
        resolved.startImage?.source === 'asset' && Boolean(resolved.startImage?.assetId);
      const startImageUrlHost =
        !isCharacterAsset && resolved.startImage?.url
          ? safeUrlHost(resolved.startImage.url)
          : null;

      log.info('Render generation started', {
        generationId: generation.id,
        tier: 'render',
        model,
        promptLength: prompt.trim().length,
        aspectRatio: resolved.aspectRatio ?? null,
        hasStartImage: Boolean(resolved.startImage),
        isCharacterAsset,
        startImageUrlHost,
        characterAssetId: isCharacterAsset ? resolved.startImage?.assetId ?? null : null,
        faceSwapApplied: faceSwapMeta.faceSwapApplied,
        faceSwapUrlHost: faceSwapMeta.faceSwapUrl ? safeUrlHost(faceSwapMeta.faceSwapUrl) : null,
        characterAssetIdOverride: faceSwapMeta.characterAssetId,
        ...motionMeta,
      });

      const controller = new AbortController();
      inFlightRef.current.set(generation.id, controller);

      try {
        const resolvedStartImage = !isCharacterAsset
          ? await resolveStartImageUrl(resolved.startImage ?? null)
          : resolved.startImage ?? null;
        const requestStartImageUrlHost =
          !isCharacterAsset && resolvedStartImage?.url
            ? safeUrlHost(resolvedStartImage.url)
            : startImageUrlHost;

        log.info('Render request dispatched', {
          generationId: generation.id,
          model,
          aspectRatio: resolved.aspectRatio ?? null,
          isCharacterAsset,
          startImageUrlHost: requestStartImageUrlHost,
          faceSwapApplied: faceSwapMeta.faceSwapApplied,
          faceSwapUrlHost: faceSwapMeta.faceSwapUrl ? safeUrlHost(faceSwapMeta.faceSwapUrl) : null,
          characterAssetId: faceSwapMeta.characterAssetId,
          ...motionMeta,
        });
        const response = await generateVideoPreview(prompt, resolved.aspectRatio ?? undefined, model, {
          ...(!isCharacterAsset && resolvedStartImage?.url
            ? { startImage: resolvedStartImage.url }
            : {}),
          ...(isCharacterAsset ? { characterAssetId: resolved.startImage?.assetId } : {}),
          ...(!isCharacterAsset && resolved.characterAssetId
            ? { characterAssetId: resolved.characterAssetId }
            : {}),
          ...(resolved.generationParams ? { generationParams: resolved.generationParams } : {}),
          ...(resolved.faceSwapAlreadyApplied ? { faceSwapAlreadyApplied: true } : {}),
        });
        if (controller.signal.aborted) return;

        log.info('Render response received', {
          generationId: generation.id,
          success: response.success,
          hasVideoUrl: Boolean(response.videoUrl),
          hasJobId: Boolean(response.jobId),
          jobId: response.jobId ?? null,
          faceSwapApplied: response.faceSwapApplied ?? false,
          faceSwapUrlHost: response.faceSwapUrl ? safeUrlHost(response.faceSwapUrl) : null,
          ...motionMeta,
        });
        if (response.faceSwapApplied || response.faceSwapUrl) {
          dispatch({
            type: 'UPDATE_GENERATION',
            payload: {
              id: generation.id,
              updates: {
                faceSwapApplied: response.faceSwapApplied ?? true,
                faceSwapUrl: response.faceSwapUrl ?? generation.faceSwapUrl ?? null,
              },
            },
          });
        }
        let videoUrl: string | null = null;
        let videoStoragePath: string | null = response.storagePath ?? null;
        let videoAssetId: string | null = response.assetId ?? null;
        if (response.success && response.videoUrl) {
          videoUrl = response.videoUrl;
        } else if (response.success && response.jobId) {
          log.debug('Waiting for render job to complete', {
            generationId: generation.id,
            jobId: response.jobId,
          });
          const jobResult = await waitForVideoJob(response.jobId, controller.signal);
          videoUrl = jobResult?.videoUrl ?? null;
          videoStoragePath = jobResult?.storagePath ?? videoStoragePath;
          videoAssetId = jobResult?.assetId ?? videoAssetId;
          log.debug('Render job completed', {
            generationId: generation.id,
            jobId: response.jobId,
            hasVideoUrl: Boolean(videoUrl),
          });
        }

        if (controller.signal.aborted) return;
        if (!videoUrl) {
          log.warn('Render completed without a video URL', {
            generationId: generation.id,
            jobId: response.jobId ?? null,
            error: response.error || response.message || 'Failed to render video',
            ...motionMeta,
          });
          throw new Error(response.error || response.message || 'Failed to render video');
        }
        const durationMs = Date.now() - startedAt;
        log.info('Render generation succeeded', {
          generationId: generation.id,
          durationMs,
          faceSwapApplied: response?.faceSwapApplied ?? faceSwapMeta.faceSwapApplied,
          ...motionMeta,
        });
        finalizeGeneration(generation.id, {
          status: 'completed',
          completedAt: Date.now(),
          mediaUrls: [videoUrl],
          ...(videoAssetId
            ? { mediaAssetIds: [videoAssetId] }
            : videoStoragePath
              ? { mediaAssetIds: [videoStoragePath] }
              : {}),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isInsufficientCreditsError(error)) {
          dispatch({ type: 'REMOVE_GENERATION', payload: { id: generation.id } });
          inFlightRef.current.delete(generation.id);
          optionsRef.current.onInsufficientCredits?.(requiredCredits, operationLabel);
          return;
        }
        const durationMs = Date.now() - startedAt;
        const info = sanitizeError(error);
        const errObj = error instanceof Error ? error : new Error(info.message);

        log.error('Render generation failed', errObj, {
          generationId: generation.id,
          durationMs,
          errorName: info.name,
          ...motionMeta,
        });
        finalizeGeneration(generation.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: errObj.message,
        });
      }
    },
    [dispatch, finalizeGeneration]
  );

  const cancelGeneration = useCallback(
    (id: string) => {
      const controller = inFlightRef.current.get(id);
      log.info('Cancel generation requested', {
        generationId: id,
        hasController: Boolean(controller),
      });
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
      const motionMeta = extractMotionMeta(opts.generationParams);
      log.info('Retry generation requested', {
        generationId: id,
        tier: generation.tier,
        model: generation.model,
        promptLength: generation.prompt.trim().length,
        ...motionMeta,
      });
      const params: GenerationParams = {
        promptVersionId: generation.promptVersionId ?? opts.promptVersionId ?? null,
        aspectRatio: generation.aspectRatio ?? opts.aspectRatio ?? null,
        duration: generation.duration ?? opts.duration ?? null,
        fps: generation.fps ?? opts.fps ?? null,
        generationParams: opts.generationParams,
      };
      if (generation.tier === 'draft') {
        generateDraft(generation.model as DraftModel, generation.prompt, params);
        return;
      }
      generateRender(generation.model, generation.prompt, params);
    },
    [generateDraft, generateRender]
  );

  return { generateDraft, generateRender, generateStoryboard, cancelGeneration, retryGeneration };
}
