/**
 * Image Observation Types
 *
 * Lightweight observation data extracted from images.
 * NOT a full scene description - just enough to filter/warn.
 */

import type {
  ShotType,
  CameraAngle,
  LightingQuality,
  SubjectPosition,
  CameraMovement,
} from '@shared/cinematography';

export interface SubjectObservation {
  type: 'person' | 'animal' | 'object' | 'scene' | 'abstract';
  description: string;
  position: SubjectPosition;
  confidence: number;
}

export interface FramingObservation {
  shotType: ShotType;
  angle: CameraAngle;
  confidence: number;
}

export interface LightingObservation {
  quality: LightingQuality;
  timeOfDay: 'day' | 'night' | 'golden-hour' | 'blue-hour' | 'indoor' | 'unknown';
  confidence: number;
}

export interface MotionCompatibility {
  recommended: CameraMovement[];
  risky: CameraMovement[];
  risks: Array<{ movement: CameraMovement; reason: string }>;
}

export interface ImageObservation {
  imageHash: string;
  observedAt: Date;
  subject: SubjectObservation;
  framing: FramingObservation;
  lighting: LightingObservation;
  motion: MotionCompatibility;
  confidence: number;
}

export interface ImageObservationRequest {
  image: string;
  sourcePrompt?: string;
  skipCache?: boolean;
}

export interface ImageObservationResult {
  success: boolean;
  observation?: ImageObservation;
  error?: string;
  cached: boolean;
  usedFastPath: boolean;
  durationMs: number;
}
