/**
 * Preview API
 *
 * API client for image preview generation
 */

import { apiClient } from '@/services/ApiClient';
import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { safeUrlHost } from '@/utils/url';
import {
  FaceSwapPreviewResponseSchema,
  GeneratePreviewResponseSchema,
  GenerateStoryboardPreviewResponseSchema,
  GenerateVideoResponseSchema,
  MediaViewUrlResponseSchema,
  UploadPreviewImageResponseSchema,
  VideoJobStatusResponseSchema,
} from './schemas';

const log = logger.child('previewApi');
const VIDEO_OPERATION = 'generateVideoPreview';

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

function requireNonEmptyString(value: unknown, name: string): asserts value is string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
}

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

export interface UploadPreviewImageResponse {
  success: boolean;
  data?: {
    imageUrl: string;
    storagePath?: string;
    viewUrl?: string;
    viewUrlExpiresAt?: string;
    sizeBytes?: number;
    contentType?: string;
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
    storagePaths?: string[];
    deltas: string[];
    baseImageUrl: string;
  };
  error?: string;
  message?: string;
}

export interface MediaViewUrlResponse {
  success: boolean;
  data?: {
    viewUrl: string;
  };
  error?: string;
  message?: string;
}

export interface FaceSwapPreviewResponse {
  success: boolean;
  data?: {
    faceSwapUrl: string;
    creditsDeducted: number;
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
  requireNonEmptyString(prompt, 'Prompt');

  const resolvedOptions: Omit<GeneratePreviewRequest, 'prompt'> | undefined =
    typeof options === 'string' ? { aspectRatio: options } : options;
  const inputImageUrl = resolvedOptions?.inputImageUrl?.trim();
  const isKontext =
    resolvedOptions?.provider === 'replicate-flux-kontext-fast' || Boolean(inputImageUrl);

  const payload = (await apiClient.post(
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
  )) as unknown;

  return GeneratePreviewResponseSchema.parse(payload);
}

/**
 * Generate a storyboard preview (base frame + chained edits)
 */
export async function generateStoryboardPreview(
  prompt: string,
  options?: Omit<GenerateStoryboardPreviewRequest, 'prompt'>
): Promise<GenerateStoryboardPreviewResponse> {
  requireNonEmptyString(prompt, 'Prompt');

  const seedImageUrl = options?.seedImageUrl?.trim();

  const payload = (await apiClient.post(
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
  )) as unknown;

  return GenerateStoryboardPreviewResponseSchema.parse(payload);
}

export async function faceSwapPreview(options: {
  characterAssetId: string;
  targetImageUrl: string;
  aspectRatio?: string;
}): Promise<FaceSwapPreviewResponse> {
  requireNonEmptyString(options?.characterAssetId, 'characterAssetId');
  requireNonEmptyString(options?.targetImageUrl, 'targetImageUrl');

  const payload = (await apiClient.post('/preview/face-swap', {
    characterAssetId: options.characterAssetId.trim(),
    targetImageUrl: options.targetImageUrl.trim(),
    ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
  })) as unknown;

  const parsed = FaceSwapPreviewResponseSchema.parse(payload);

  log.info('Face-swap preview request completed', {
    hasFaceSwapUrl: Boolean(parsed.data?.faceSwapUrl),
    faceSwapUrlHost: parsed.data?.faceSwapUrl ? safeUrlHost(parsed.data.faceSwapUrl) : null,
    creditsDeducted: parsed.data?.creditsDeducted ?? null,
  });

  return parsed;
}

export async function getImageAssetViewUrl(assetId: string): Promise<MediaViewUrlResponse> {
  requireNonEmptyString(assetId, 'assetId');

  const encoded = encodeURIComponent(assetId.trim());
  const payload = (await apiClient.get(`/preview/image/view?assetId=${encoded}`)) as unknown;
  return MediaViewUrlResponseSchema.parse(payload);
}

export async function getVideoAssetViewUrl(assetId: string): Promise<MediaViewUrlResponse> {
  requireNonEmptyString(assetId, 'assetId');

  const encoded = encodeURIComponent(assetId.trim());
  const payload = (await apiClient.get(`/preview/video/view?assetId=${encoded}`)) as unknown;
  return MediaViewUrlResponseSchema.parse(payload);
}

export async function uploadPreviewImage(
  file: File,
  metadata: Record<string, unknown> = {},
  options: { source?: string; label?: string } = {}
): Promise<UploadPreviewImageResponse> {
  const authHeaders = await buildFirebaseAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  if (Object.keys(metadata).length > 0) {
    formData.append('metadata', JSON.stringify(metadata));
  }
  if (options.source) {
    formData.append('source', options.source);
  }
  if (options.label) {
    formData.append('label', options.label);
  }

  const response = await fetch(`${API_CONFIG.baseURL}/preview/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
    body: formData,
  });

  let payload: UploadPreviewImageResponse | null = null;
  try {
    payload = (await response.json()) as UploadPreviewImageResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Failed to upload image');
  }

  if (!payload) {
    return UploadPreviewImageResponseSchema.parse({
      success: false,
      error: 'Failed to upload image',
    });
  }

  const parsed = UploadPreviewImageResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return UploadPreviewImageResponseSchema.parse({
      success: false,
      error: 'Failed to upload image',
    });
  }

  return parsed.data;
}

export interface GenerateVideoResponse {
  success: boolean;
  videoUrl?: string;
  storagePath?: string;
  viewUrl?: string;
  viewUrlExpiresAt?: string;
  sizeBytes?: number;
  inputMode?: 't2v' | 'i2v';
  startImageUrl?: string;
  jobId?: string;
  status?: VideoJobStatus;
  creditsReserved?: number;
  creditsDeducted?: number;
  keyframeGenerated?: boolean;
  keyframeUrl?: string | null;
  faceSwapApplied?: boolean;
  faceSwapUrl?: string | null;
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
  inputMode?: 't2v' | 'i2v';
  startImageUrl?: string;
  creditsReserved?: number;
  creditsDeducted?: number;
  error?: string;
  message?: string;
}

export interface GenerateVideoPreviewOptions {
  startImage?: string | undefined;
  inputReference?: string | undefined;
  generationParams?: Record<string, unknown> | undefined;
  characterAssetId?: string | undefined;
  autoKeyframe?: boolean | undefined;
  faceSwapAlreadyApplied?: boolean | undefined;
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
  requireNonEmptyString(prompt, 'Prompt');
  const trimmedPrompt = prompt.trim();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const motionMeta = extractMotionMeta(options?.generationParams);
  const startImageUrlHost = safeUrlHost(options?.startImage);
  const inputReferenceUrlHost = safeUrlHost(options?.inputReference);

  const payload = {
    prompt: trimmedPrompt,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(model ? { model } : {}),
    ...(options?.startImage ? { startImage: options.startImage } : {}),
    ...(options?.inputReference ? { inputReference: options.inputReference } : {}),
    ...(options?.generationParams ? { generationParams: options.generationParams } : {}),
    ...(options?.characterAssetId ? { characterAssetId: options.characterAssetId } : {}),
    ...(options?.autoKeyframe !== undefined ? { autoKeyframe: options.autoKeyframe } : {}),
    ...(options?.faceSwapAlreadyApplied ? { faceSwapAlreadyApplied: true } : {}),
  };

  log.info('Video preview request started', {
    operation: VIDEO_OPERATION,
    promptLength: trimmedPrompt.length,
    aspectRatio: aspectRatio ?? null,
    model: model ?? null,
    hasStartImage: Boolean(options?.startImage),
    startImageUrlHost,
    hasInputReference: Boolean(options?.inputReference),
    inputReferenceUrlHost,
    hasCharacterAssetId: Boolean(options?.characterAssetId),
    autoKeyframe: options?.autoKeyframe ?? null,
    faceSwapAlreadyApplied: options?.faceSwapAlreadyApplied ?? null,
    ...motionMeta,
  });

  try {
    const responsePayload = (await apiClient.post(
      '/preview/video/generate',
      payload,
      {
        timeout: API_CONFIG.timeout.video,
      }
    )) as unknown;

    const response = GenerateVideoResponseSchema.parse(responsePayload);

    const durationMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
    );

    log.info('Video preview request succeeded', {
      operation: VIDEO_OPERATION,
      durationMs,
      success: response.success,
      hasVideoUrl: Boolean(response.videoUrl),
      hasJobId: Boolean(response.jobId),
      jobId: response.jobId ?? null,
      creditsReserved: response.creditsReserved ?? null,
      creditsDeducted: response.creditsDeducted ?? null,
      ...motionMeta,
    });

    return response;
  } catch (error) {
    const durationMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
    );
    const info = sanitizeError(error);
    const errObj = error instanceof Error ? error : new Error(info.message);

    log.error('Video preview request failed', errObj, {
      operation: VIDEO_OPERATION,
      durationMs,
      promptLength: trimmedPrompt.length,
      aspectRatio: aspectRatio ?? null,
      model: model ?? null,
      hasStartImage: Boolean(options?.startImage),
      startImageUrlHost,
      hasInputReference: Boolean(options?.inputReference),
      inputReferenceUrlHost,
      hasCharacterAssetId: Boolean(options?.characterAssetId),
      autoKeyframe: options?.autoKeyframe ?? null,
      faceSwapAlreadyApplied: options?.faceSwapAlreadyApplied ?? null,
      errorName: info.name,
      ...motionMeta,
    });
    throw errObj;
  }
}

export async function getVideoPreviewStatus(jobId: string): Promise<VideoJobStatusResponse> {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('jobId is required');
  }

  const payload = (await apiClient.get(`/preview/video/jobs/${jobId}`, {
    fetchOptions: {
      cache: 'no-store',
    },
  })) as unknown;

  return VideoJobStatusResponseSchema.parse(payload);
}
