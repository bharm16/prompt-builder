/**
 * I2V Types for frontend usage
 */

export type I2VConstraintMode = 'strict' | 'flexible' | 'transform';

export type LockStatus = 'hard' | 'soft' | 'unlocked';

export type LockableCategory =
  | 'subject.identity'
  | 'subject.appearance'
  | 'shot.type'
  | 'shot.angle'
  | 'lighting'
  | 'environment'
  | 'color'
  | 'camera.movement';

export interface LockMap {
  'subject.identity': LockStatus;
  'subject.appearance': LockStatus;
  'shot.type': LockStatus;
  'shot.angle': LockStatus;
  'lighting': LockStatus;
  'environment': LockStatus;
  'color': LockStatus;
  'camera.movement': LockStatus;
}

export function deriveLockMap(
  mode: I2VConstraintMode,
  options?: { cameraMotionLocked?: boolean }
): LockMap {
  const cameraLock: LockStatus = options?.cameraMotionLocked ? 'hard' : 'unlocked';

  switch (mode) {
    case 'strict':
      return {
        'subject.identity': 'hard',
        'subject.appearance': 'hard',
        'shot.type': 'hard',
        'shot.angle': 'hard',
        'lighting': 'hard',
        'environment': 'hard',
        'color': 'hard',
        'camera.movement': cameraLock,
      };
    case 'flexible':
      return {
        'subject.identity': 'hard',
        'subject.appearance': 'soft',
        'shot.type': 'hard',
        'shot.angle': 'soft',
        'lighting': 'soft',
        'environment': 'soft',
        'color': 'soft',
        'camera.movement': cameraLock,
      };
    case 'transform':
      return {
        'subject.identity': 'soft',
        'subject.appearance': 'unlocked',
        'shot.type': 'soft',
        'shot.angle': 'unlocked',
        'lighting': 'unlocked',
        'environment': 'unlocked',
        'color': 'unlocked',
        'camera.movement': cameraLock,
      };
  }
}

export interface ConflictWarning {
  category: LockableCategory;
  userSaid: string;
  imageShows: string;
  severity: 'info' | 'warning' | 'blocked';
}

export interface ImageObservation {
  imageHash?: string;
  subject: {
    type: string;
    description: string;
    position: string;
    confidence?: number;
  };
  framing: {
    shotType: string;
    angle: string;
    confidence?: number;
  };
  lighting: {
    quality: string;
    timeOfDay: string;
    confidence?: number;
  };
  motion: {
    recommended: string[];
    risky: string[];
    risks?: Array<{ movement: string; reason: string }>;
  };
  confidence?: number;
}

export interface I2VOptimizationResult {
  prompt: string;
  conflicts: ConflictWarning[];
  appliedMode: I2VConstraintMode;
  lockMap: LockMap;
  extractedMotion: {
    subjectAction: string | null;
    cameraMovement: string | null;
    pacing: string | null;
  };
}

export interface I2VContext {
  isI2VMode: boolean;
  startImageUrl: string | null;
  observation: ImageObservation | null;
  lockMap: LockMap | null;
  constraintMode: I2VConstraintMode;
  isAnalyzing: boolean;
  error: string | null;
  setConstraintMode: (mode: I2VConstraintMode) => void;
  refreshObservation: () => Promise<void>;
}
