import type { GenerationMediaType, GenerationSettingsSnapshot } from '@/features/prompt-optimizer/GenerationsPanel/types';

export type GalleryTier = 'preview' | 'draft' | 'final';
export type GalleryFilter = 'all' | 'preview' | 'draft' | 'favorites';

export interface GalleryPromptSpan {
  start: number;
  end: number;
  category: string;
}

export interface GalleryGeneration {
  id: string;
  tier: GalleryTier;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  mediaType: GenerationMediaType;
  prompt: string;
  model: string;
  duration?: string | undefined;
  resolution?: string | undefined;
  aspectRatio?: string | undefined;
  createdAt: number;
  isFavorite: boolean;
  generationSettings: GenerationSettingsSnapshot | null;
  promptSpans?: GalleryPromptSpan[] | undefined;
}

export interface GalleryPanelProps {
  generations: GalleryGeneration[];
  activeGenerationId?: string | null | undefined;
  onSelectGeneration: (generationId: string) => void;
  onClose: () => void;
}

