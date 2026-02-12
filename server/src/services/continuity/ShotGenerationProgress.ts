import type { ContinuityShot } from './types';

export type ShotGenerationStage =
  | 'extracting-frame'
  | 'generating-keyframe'
  | 'generating-video'
  | 'quality-gate'
  | 'retrying'
  | 'completed'
  | 'failed';

export interface ShotGenerationEvent {
  shotId: string;
  stage: ShotGenerationStage;
  progress: number;
  message: string;
  metadata?: {
    continuityMechanismUsed?: ContinuityShot['continuityMechanismUsed'];
    generatedKeyframeUrl?: string;
    frameBridgeUrl?: string;
    styleScore?: number;
    identityScore?: number;
    styleDegraded?: boolean;
    styleDegradedReason?: string;
    retryCount?: number;
    error?: string;
  };
}

export interface ShotGenerationObserver {
  onStage: (event: ShotGenerationEvent) => void;
}
