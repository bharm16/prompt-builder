/**
 * Image preview provider types
 */

export const IMAGE_PREVIEW_PROVIDER_IDS = ['replicate-flux-schnell'] as const;

export type ImagePreviewProviderId = (typeof IMAGE_PREVIEW_PROVIDER_IDS)[number];

export type ImagePreviewProviderSelection = ImagePreviewProviderId | 'auto';

export interface ImagePreviewRequest {
  prompt: string;
  aspectRatio?: string;
  userId: string;
}

export interface ImagePreviewResult {
  imageUrl: string;
  model: string;
  durationMs: number;
  aspectRatio: string;
}

export interface ImagePreviewProvider {
  id: ImagePreviewProviderId;
  displayName: string;

  isAvailable(): boolean;

  generatePreview(request: ImagePreviewRequest): Promise<ImagePreviewResult>;
}
