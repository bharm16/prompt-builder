/**
 * Preview API
 *
 * API client for image preview generation
 */

import { apiClient } from '@/services/ApiClient';
import { API_CONFIG } from '@/config/api.config';

export type PreviewProvider =
  | 'replicate-flux-schnell'
  | 'replicate-flux-kontext-fast'
  | 'auto';

export type PreviewSpeedMode = 'Lightly Juiced' | 'Juiced' | 'Extra Juiced' | 'Real Time';

export interface GeneratePreviewRequest {
  prompt: string;
  aspectRatio?: string;
  provider?: PreviewProvider;
  inputImageUrl?: string;
  seed?: number;
  speedMode?: PreviewSpeedMode;
  outputQuality?: number;
}

export interface GeneratePreviewResponse {
  success: boolean;
  data?: {
    imageUrl: string;
    storagePath?: string;
    viewUrl?: string;
    viewUrlExpiresAt?: string;
    sizeBytes?: number;
    metadata: {
      aspectRatio: string;
      model: string;
      duration: number;
      generatedAt: string;
    };
  };
  error?: string;
  message?: string;
}

export interface GenerateStoryboardPreviewRequest {
  prompt: string;
  aspectRatio?: string;
  seedImageUrl?: string;
  speedMode?: PreviewSpeedMode;
  seed?: number;
}

export interface GenerateStoryboardPreviewResponse {
  success: boolean;
  data?: {
    imageUrls: string[];
    deltas: string[];
    baseImageUrl: string;
  };
  error?: string;
  message?: string;
}

/**
 * Generate a preview image from a prompt
 *
 * @param prompt - The prompt text to generate an image from
 * @param aspectRatio - Optional aspect ratio (default: "16:9")
 * @returns Promise resolving to the preview response
 */
export async function generatePreview(
  prompt: string,
  options?: string | Omit<GeneratePreviewRequest, 'prompt'>
): Promise<GeneratePreviewResponse> {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }

  const resolvedOptions =
    typeof options === 'string' ? ({ aspectRatio: options } as const) : options;
  const inputImageUrl = resolvedOptions?.inputImageUrl?.trim();
  const isKontext =
    resolvedOptions?.provider === 'replicate-flux-kontext-fast' || Boolean(inputImageUrl);

  return apiClient.post(
    '/preview/generate',
    {
      prompt: prompt.trim(),
      ...(resolvedOptions?.aspectRatio ? { aspectRatio: resolvedOptions.aspectRatio } : {}),
      ...(resolvedOptions?.provider ? { provider: resolvedOptions.provider } : {}),
      ...(inputImageUrl ? { inputImageUrl } : {}),
      ...(resolvedOptions?.seed !== undefined ? { seed: resolvedOptions.seed } : {}),
      ...(resolvedOptions?.speedMode ? { speedMode: resolvedOptions.speedMode } : {}),
      ...(resolvedOptions?.outputQuality !== undefined
        ? { outputQuality: resolvedOptions.outputQuality }
        : {}),
    },
    isKontext ? { timeout: 60000 } : {}
  ) as Promise<GeneratePreviewResponse>;
}

/**
 * Generate a storyboard preview (base frame + chained edits)
 */
export async function generateStoryboardPreview(
  prompt: string,
  options?: Omit<GenerateStoryboardPreviewRequest, 'prompt'>
): Promise<GenerateStoryboardPreviewResponse> {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }

  const seedImageUrl = options?.seedImageUrl?.trim();

  return apiClient.post(
    '/preview/generate/storyboard',
    {
      prompt: prompt.trim(),
      ...(options?.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
      ...(seedImageUrl ? { seedImageUrl } : {}),
      ...(options?.speedMode ? { speedMode: options.speedMode } : {}),
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
    },
    {
      timeout: API_CONFIG.timeout.storyboard,
    }
  ) as Promise<GenerateStoryboardPreviewResponse>;
}

export interface GenerateVideoResponse {
  success: boolean;
  videoUrl?: string;
  storagePath?: string;
  viewUrl?: string;
  viewUrlExpiresAt?: string;
  sizeBytes?: number;
  jobId?: string;
  status?: VideoJobStatus;
  creditsReserved?: number;
  creditsDeducted?: number;
  error?: string;
  message?: string;
}

export type VideoJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoJobStatusResponse {
  success: boolean;
  jobId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  assetId?: string;
  contentType?: string;
  storagePath?: string;
  viewUrl?: string;
  viewUrlExpiresAt?: string;
  sizeBytes?: number;
  creditsReserved?: number;
  creditsDeducted?: number;
  error?: string;
  message?: string;
}

export interface GenerateVideoPreviewOptions {
  startImage?: string;
  inputReference?: string;
  generationParams?: Record<string, unknown>;
}

/**
 * Generate a preview video from a prompt
 */
export async function generateVideoPreview(
  prompt: string,
  aspectRatio?: string,
  model?: string,
  options?: GenerateVideoPreviewOptions
): Promise<GenerateVideoResponse> {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }

  return apiClient.post('/preview/video/generate', {
    prompt: prompt.trim(),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(model ? { model } : {}),
    ...(options?.startImage ? { startImage: options.startImage } : {}),
    ...(options?.inputReference ? { inputReference: options.inputReference } : {}),
    ...(options?.generationParams ? { generationParams: options.generationParams } : {}),
  }, {
    timeout: API_CONFIG.timeout.video
  }) as Promise<GenerateVideoResponse>;
}

export async function getVideoPreviewStatus(jobId: string): Promise<VideoJobStatusResponse> {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('jobId is required');
  }

  return apiClient.get(`/preview/video/jobs/${jobId}`, {
    fetchOptions: {
      cache: 'no-store',
    },
  }) as Promise<VideoJobStatusResponse>;
}
