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
  estimatedCost?: number | null;
  actualCost?: number | null;
  aspectRatio?: string | null;
  duration?: number | null;
  fps?: number | null;
  mediaType: GenerationMediaType;
  mediaUrls: string[];
  mediaAssetIds?: string[];
  thumbnailUrl?: string | null;
  error?: string | null;
}

export interface GenerationParams {
  promptVersionId?: string | null;
  aspectRatio?: string | null;
  duration?: number | null;
  fps?: number | null;
  generationParams?: Record<string, unknown>;
  startImage?: {
    url: string;
    assetId?: string;
    source?: 'preview' | 'upload' | 'asset' | 'library' | 'keyframe' | 'generation';
  } | null;
}

export interface GenerationsPanelProps {
  prompt: string;
  promptVersionId: string;
  aspectRatio: string;
  duration?: number;
  fps?: number;
  generationParams?: Record<string, unknown>;
  initialGenerations?: Generation[];
  onGenerationsChange?: (generations: Generation[]) => void;
  className?: string;
  versions: PromptVersionEntry[];
  onRestoreVersion: (versionId: string) => void;
  onCreateVersionIfNeeded: () => string;
}
