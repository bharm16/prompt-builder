import type { RefObject } from 'react';
import type { Asset } from '@shared/types/asset';
import type { CameraPath } from '@/features/convergence/types';
import type { OptimizationOptions } from '@/features/prompt-optimizer/types';
import type { DraftModel, KeyframeTile, VideoTier } from '@components/ToolSidebar/types';

export type GenerationControlsTab = 'video' | 'image';
export type ImageSubTab = 'references' | 'styles';

export interface GenerationControlsPanelProps {
  prompt: string;
  onPromptChange?: (prompt: string) => void;
  onOptimize?: (
    promptToOptimize?: string,
    options?: OptimizationOptions
  ) => Promise<void>;
  showResults?: boolean;
  isProcessing?: boolean;
  isRefining?: boolean;
  genericOptimizedPrompt?: string | null;
  promptInputRef?: RefObject<HTMLTextAreaElement | null>;
  assets?: Asset[];
  onInsertTrigger?: (trigger: string, range?: { start: number; end: number }) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  aspectRatio: string;
  duration: number;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onAspectRatioChange: (ratio: string) => void;
  onDurationChange: (duration: number) => void;
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  isDraftDisabled: boolean;
  isRenderDisabled: boolean;
  onBack?: () => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  keyframes: KeyframeTile[];
  onAddKeyframe: (tile: Omit<KeyframeTile, 'id'>) => void;
  onRemoveKeyframe: (id: string) => void;
  onClearKeyframes?: () => void;
  tier: VideoTier;
  onTierChange: (tier: VideoTier) => void;
  onStoryboard: () => void;
  activeDraftModel?: string | null;
  showMotionControls?: boolean;
  cameraMotion?: CameraPath | null;
  onCameraMotionChange?: (cameraPath: CameraPath | null) => void;
  /** @deprecated Subject motion is now part of the main prompt. */
  subjectMotion?: string;
  /** @deprecated Subject motion is now part of the main prompt. */
  onSubjectMotionChange?: (motion: string) => void;
}
