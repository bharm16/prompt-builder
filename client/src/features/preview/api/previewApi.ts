/**
 * Preview API
 *
 * API client for image preview generation
 */

import { apiClient } from '@/services/ApiClient';

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

  return apiClient.post('/api/preview/generate', {
    prompt: prompt.trim(),
    ...(aspectRatio ? { aspectRatio } : {}),
  }) as Promise<GeneratePreviewResponse>;
}

