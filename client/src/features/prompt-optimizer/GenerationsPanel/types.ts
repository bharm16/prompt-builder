import type { PromptVersionEntry } from '@hooks/types';

export type GenerationTier = 'draft' | 'render';
export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type GenerationMediaType = 'image' | 'video' | 'image-sequence';

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

export interface GenerationsPanelProps {
  prompt: string;
  promptVersionId: string;
  aspectRatio: string;
  duration?: number | undefined;
  fps?: number | undefined;
  generationParams?: Record<string, unknown> | undefined;
  initialGenerations?: Generation[] | undefined;
  onGenerationsChange?: (generations: Generation[]) => void;
  className?: string;
  versions: PromptVersionEntry[];
  onRestoreVersion: (versionId: string) => void;
  onCreateVersionIfNeeded: () => string;
}
