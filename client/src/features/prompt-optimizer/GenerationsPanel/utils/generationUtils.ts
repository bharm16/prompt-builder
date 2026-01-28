import type { Generation, GenerationParams } from '../types';
import { getModelConfig } from '../config/generationConfig';

export const createGenerationId = (): string =>
  `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const resolveGenerationOptions = (
  base?: GenerationParams,
  overrides?: GenerationParams
): GenerationParams => ({
  promptVersionId: overrides?.promptVersionId ?? base?.promptVersionId ?? null,
  aspectRatio: overrides?.aspectRatio ?? base?.aspectRatio ?? null,
  duration: overrides?.duration ?? base?.duration ?? null,
  fps: overrides?.fps ?? base?.fps ?? null,
  generationParams: overrides?.generationParams ?? base?.generationParams,
  startImage: overrides?.startImage ?? base?.startImage ?? null,
});

export const buildGeneration = (
  tier: Generation['tier'],
  model: string,
  prompt: string,
  params: GenerationParams
): Generation => {
  const config = getModelConfig(model);
  return {
    id: createGenerationId(),
    tier,
    status: 'pending',
    model,
    prompt,
    promptVersionId: params.promptVersionId ?? null,
    createdAt: Date.now(),
    completedAt: null,
    estimatedCost: config?.credits ?? null,
    actualCost: null,
    aspectRatio: params.aspectRatio ?? null,
    duration: params.duration ?? null,
    fps: params.fps ?? null,
    mediaType: config?.mediaType ?? 'video',
    mediaUrls: [],
    thumbnailUrl: null,
    error: null,
  };
};
