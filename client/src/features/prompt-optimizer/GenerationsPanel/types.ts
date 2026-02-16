import type { PromptVersionEntry } from '@hooks/types';
import type {
  DraftModel,
  GenerationOverrides,
  VideoTier,
} from '@components/ToolSidebar/types';
import type { Asset } from '@shared/types/asset';
import type { TimelineItem } from './hooks/useGenerationsTimeline';

export type GenerationTier = 'draft' | 'render';
export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type GenerationMediaType = 'image' | 'video' | 'image-sequence';

export interface GenerationSettingsSnapshot {
  selectedModel?: string | null | undefined;
  videoTier?: VideoTier | null | undefined;
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

export interface GenerationsPanelStateSnapshot {
  generations: Generation[];
  activeGenerationId: string | null;
  isGenerating: boolean;
  selectedFrameUrl: string | null;
}

export interface GenerationsPanelRuntime {
  generations: Generation[];
  activeGenerationId: string | null;
  isGenerating: boolean;
  selectedFrameUrl: string | null;
  keyframeStep: {
    isActive: boolean;
    character: Asset | null;
    pendingModel: string | null;
  };
  timeline: TimelineItem[];
  totalVisibleGenerations: number;
  isSequenceMode: boolean;
  hasActiveContinuityShot: boolean;
  isStartingSequence: boolean;
  heroGeneration: Generation | null;
  activeDraftModel: string | null;
  handleDraft: (model: DraftModel, overrides?: GenerationOverrides) => void;
  handleRenderWithFaceSwap: (
    model: string,
    overrides?: GenerationOverrides
  ) => void;
  handleStoryboard: () => void;
  handleApproveKeyframe: (keyframeUrl: string) => void;
  handleSkipKeyframe: () => void;
  handleRetry: (generation: Generation) => void;
  handleDelete: (generation: Generation) => void;
  handleDownload: (generation: Generation) => void;
  handleCancel: (generation: Generation) => void;
  handleContinueSequence: (generation: Generation) => void;
  handleSelectFrame: (
    url: string,
    frameIndex: number,
    generationId: string
  ) => void;
  handleClearSelectedFrame: () => void;
  setActiveGeneration: (generationId: string | null) => void;
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
  presentation?: 'timeline' | 'hero' | undefined;
  onStateSnapshot?: ((snapshot: GenerationsPanelStateSnapshot) => void) | undefined;
  heroOverrideGenerationId?: string | null | undefined;
  runtime?: GenerationsPanelRuntime | undefined;
  className?: string;
  versions: PromptVersionEntry[];
  onRestoreVersion: (versionId: string) => void;
  onCreateVersionIfNeeded: () => string;
}
