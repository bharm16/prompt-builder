/**
 * Shared cinematography vocabulary
 * Used across server + client for consistent enums and mappings.
 */

export const SHOT_TYPES = [
  'extreme-close-up',
  'close-up',
  'medium-close-up',
  'medium',
  'medium-wide',
  'wide',
  'extreme-wide',
] as const;

export const CAMERA_ANGLES = [
  'eye-level',
  'low-angle',
  'high-angle',
  'birds-eye',
  'worms-eye',
  'dutch',
  'over-shoulder',
] as const;

export const CAMERA_MOVEMENTS = [
  'static',
  'pan-left',
  'pan-right',
  'tilt-up',
  'tilt-down',
  'dolly-in',
  'dolly-out',
  'truck-left',
  'truck-right',
  'crane-up',
  'crane-down',
  'arc-left',
  'arc-right',
  'zoom-in',
  'zoom-out',
] as const;

export const LIGHTING_QUALITIES = [
  'natural',
  'artificial',
  'dramatic',
  'flat',
  'mixed',
] as const;

export const SUBJECT_POSITIONS = [
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'left-third',
  'right-third',
] as const;

export type ShotType = typeof SHOT_TYPES[number];
export type CameraAngle = typeof CAMERA_ANGLES[number];
export type CameraMovement = typeof CAMERA_MOVEMENTS[number];
export type LightingQuality = typeof LIGHTING_QUALITIES[number];
export type SubjectPosition = typeof SUBJECT_POSITIONS[number];

/**
 * Camera movements that work well with each shot type
 */
export const SHOT_MOVEMENT_COMPATIBILITY: Record<ShotType, CameraMovement[]> = {
  'extreme-close-up': ['static', 'dolly-out'],
  'close-up': ['static', 'dolly-in', 'dolly-out'],
  'medium-close-up': ['static', 'dolly-in', 'dolly-out', 'pan-left', 'pan-right'],
  'medium': ['static', 'dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'truck-left', 'truck-right'],
  'medium-wide': CAMERA_MOVEMENTS.filter((movement) => movement !== 'zoom-in'),
  'wide': [...CAMERA_MOVEMENTS],
  'extreme-wide': [...CAMERA_MOVEMENTS],
};

/**
 * Camera movements to avoid based on subject position
 */
export const POSITION_MOVEMENT_RISKS: Record<SubjectPosition, CameraMovement[]> = {
  'center': [],
  'left': ['pan-right', 'truck-left'],
  'right': ['pan-left', 'truck-right'],
  'top': ['tilt-down', 'crane-up'],
  'bottom': ['tilt-up', 'crane-down'],
  'left-third': ['pan-right', 'truck-left'],
  'right-third': ['pan-left', 'truck-right'],
};
