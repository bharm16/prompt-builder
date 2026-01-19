import { promptOptimizationApiV2 } from '@/services';
import { getVideoPreviewStatus } from '@/features/preview/api/previewApi';
import { getModelConfig } from '../config/generationConfig';
import type { Generation, GenerationParams } from '../types';

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 6 * 60 * 1000;
const COMPILE_TIMEOUT_MS = 4000;

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
    estimatedCost: config?.cost ?? null,
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

export async function waitForVideoJob(
  jobId: string,
  signal: AbortSignal
): Promise<string | null> {
  const startTime = Date.now();
  while (true) {
    if (signal.aborted) return null;
    const status = await getVideoPreviewStatus(jobId);
    if (signal.aborted) return null;
    if (!status.success) {
      throw new Error(status.error || status.message || 'Failed to fetch video status');
    }
    if (status.status === 'completed' && status.videoUrl) {
      return status.videoUrl;
    }
    if (status.status === 'completed') {
      throw new Error('Video generation completed but no URL was returned');
    }
    if (status.status === 'failed') {
      throw new Error(status.error || 'Video generation failed');
    }
    if (Date.now() - startTime > MAX_WAIT_MS) {
      throw new Error('Timed out waiting for video generation');
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

export async function compileWanPrompt(
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  let compiledPrompt = prompt.trim();
  const compileAbortController = new AbortController();
  const abortCompile = () => compileAbortController.abort();
  const timeoutId = window.setTimeout(() => compileAbortController.abort(), COMPILE_TIMEOUT_MS);
  signal.addEventListener('abort', abortCompile, { once: true });
  try {
    const compiled = await promptOptimizationApiV2.compilePrompt({
      prompt: compiledPrompt,
      targetModel: 'wan',
      signal: compileAbortController.signal,
    });
    if (!compileAbortController.signal.aborted) {
      const trimmed = compiled?.compiledPrompt?.trim();
      if (trimmed) compiledPrompt = trimmed;
    }
  } catch {
    // Best-effort compile; fallback to original prompt.
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', abortCompile);
  }
  return compiledPrompt;
}
