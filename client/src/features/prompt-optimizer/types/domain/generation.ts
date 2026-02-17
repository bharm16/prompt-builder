export type GenerationTier = 'draft' | 'render';
export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type GenerationMediaType = 'image' | 'video' | 'image-sequence';

export interface GenerationSettingsSnapshot {
  selectedModel?: string | null | undefined;
  videoTier?: 'draft' | 'render' | null | undefined;
  aspectRatio?: string | null | undefined;
  duration?: number | null | undefined;
  fps?: number | null | undefined;
  generationParams?: Record<string, unknown> | null | undefined;
}

export interface Generation {
  id: string;
  tier: GenerationTier;
  status: GenerationStatus;
  model: string;
  prompt: string;
  promptVersionId: string | null;
  createdAt: number;
  completedAt: number | null;
  estimatedCost?: number | null | undefined;
  actualCost?: number | null | undefined;
  aspectRatio?: string | null | undefined;
  duration?: number | null | undefined;
  fps?: number | null | undefined;
  mediaType: GenerationMediaType;
  mediaUrls: string[];
  mediaAssetIds?: string[] | undefined;
  thumbnailUrl?: string | null | undefined;
  characterAssetId?: string | null | undefined;
  faceSwapApplied?: boolean | null | undefined;
  faceSwapUrl?: string | null | undefined;
  isFavorite?: boolean | undefined;
  generationSettings?: GenerationSettingsSnapshot | null | undefined;
  error?: string | null | undefined;
}

export interface GenerationParams {
  promptVersionId?: string | null | undefined;
  aspectRatio?: string | null | undefined;
  duration?: number | null | undefined;
  fps?: number | null | undefined;
  generationParams?: Record<string, unknown> | undefined;
  startImage?: {
    url: string;
    assetId?: string | undefined;
    source?: string | undefined;
    storagePath?: string | undefined;
    viewUrlExpiresAt?: string | undefined;
  } | null | undefined;
  characterAssetId?: string | null | undefined;
  faceSwapAlreadyApplied?: boolean | undefined;
  faceSwapUrl?: string | null | undefined;
}
