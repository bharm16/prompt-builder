/**
 * Preview API
 *
 * API client for image preview generation
 */

import { apiClient } from '@/services/ApiClient';
import { API_CONFIG } from '@/config/api.config';

export interface GeneratePreviewRequest {
  prompt: string;
  aspectRatio?: string;
}

export interface GeneratePreviewResponse {
  success: boolean;
  data?: {
    imageUrl: string;
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

/**
 * Generate a preview image from a prompt
 *
 * @param prompt - The prompt text to generate an image from
 * @param aspectRatio - Optional aspect ratio (default: "16:9")
 * @returns Promise resolving to the preview response
 */
export async function generatePreview(
  prompt: string,
  aspectRatio?: string
): Promise<GeneratePreviewResponse> {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }

  return apiClient.post('/preview/generate', {
    prompt: prompt.trim(),
    ...(aspectRatio ? { aspectRatio } : {}),
  }) as Promise<GeneratePreviewResponse>;
}

export interface GenerateVideoResponse {
  success: boolean;
  videoUrl?: string;
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

  return apiClient.get(`/preview/video/jobs/${jobId}`) as Promise<VideoJobStatusResponse>;
}
