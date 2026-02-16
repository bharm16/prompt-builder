import type { GalleryGeneration } from '@/features/prompt-optimizer/components/GalleryPanel';

export interface GenerationPopoverProps {
  generations: GalleryGeneration[];
  activeId: string;
  onChange: (generationId: string) => void;
  onClose: () => void;
  onReuse: (generationId: string) => void;
  onToggleFavorite: (generationId: string, isFavorite: boolean) => void;
}

export interface PopoverPreviewProps {
  generation: GalleryGeneration;
  onBack: () => void;
  onToggleFavorite: () => void;
}

export interface PopoverThumbnailRailProps {
  generations: GalleryGeneration[];
  activeId: string;
  onChange: (generationId: string) => void;
}

export interface PopoverDetailProps {
  generation: GalleryGeneration;
  generations: GalleryGeneration[];
  activeId: string;
  onChange: (generationId: string) => void;
  onReuse: () => void;
  onCopyPrompt: () => void;
}

