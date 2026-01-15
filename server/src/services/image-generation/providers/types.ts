/**
 * Image preview provider types
 */

export const IMAGE_PREVIEW_PROVIDER_IDS = [
  'replicate-flux-schnell',
  'replicate-flux-kontext-fast',
] as const;

export type ImagePreviewProviderId = (typeof IMAGE_PREVIEW_PROVIDER_IDS)[number];

export type ImagePreviewProviderSelection = ImagePreviewProviderId | 'auto';

export type ImagePreviewSpeedMode =
  | 'Lightly Juiced'
  | 'Juiced'
  | 'Extra Juiced'
  | 'Real Time';

export interface ImagePreviewRequest {
  prompt: string;
  aspectRatio?: string;
  userId: string;
  inputImageUrl?: string;
  seed?: number;
  speedMode?: ImagePreviewSpeedMode;
  outputQuality?: number;
  disablePromptTransformation?: boolean;
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
