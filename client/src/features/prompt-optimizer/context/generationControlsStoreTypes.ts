import type { CapabilityValues } from '@shared/capabilities';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile, VideoTier } from '@components/ToolSidebar/types';

export type GenerationControlsTab = 'video' | 'image';
export type ImageSubTab = 'references' | 'styles';
export type ConstraintMode = 'strict' | 'flexible' | 'transform';

export interface GenerationControlsDomainState {
  selectedModel: string;
  generationParams: CapabilityValues;
  videoTier: VideoTier;
  keyframes: KeyframeTile[];
  startFrame: KeyframeTile | null;
  cameraMotion: CameraPath | null;
  subjectMotion: string;
}

export interface GenerationControlsUIState {
  activeTab: GenerationControlsTab;
  imageSubTab: ImageSubTab;
  constraintMode: ConstraintMode;
}

export interface GenerationControlsState {
  domain: GenerationControlsDomainState;
  ui: GenerationControlsUIState;
}

export const DEFAULT_GENERATION_CONTROLS_STATE: GenerationControlsState = {
  domain: {
    selectedModel: '',
    generationParams: {},
    videoTier: 'render',
    keyframes: [],
    startFrame: null,
    cameraMotion: null,
    subjectMotion: '',
  },
  ui: {
    activeTab: 'video',
    imageSubTab: 'references',
    constraintMode: 'strict',
  },
};
