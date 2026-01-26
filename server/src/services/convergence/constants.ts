/**
 * Constants for the Visual Convergence feature
 */

import type { CameraPath, Direction } from './types';

// ============================================================================
// Direction Options (Task 1.5)
// ============================================================================

/**
 * Available direction options for the direction fork
 * Each direction represents a high-level creative style
 */
export const DIRECTION_OPTIONS: Array<{ id: Direction; label: string }> = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'social', label: 'Social Media' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'documentary', label: 'Documentary' },
];

// ============================================================================
// Credit Cost Constants (Task 1.6)
// ============================================================================

/**
 * Credit costs for convergence operations
 * Used for credit reservation and display
 */
export const CONVERGENCE_COSTS = {
  /** Cost for generating 4 direction images (4 images × 1 credit each) */
  DIRECTION_IMAGES: 4,
  /** Cost for generating 4 dimension images (4 images × 1 credit each) */
  DIMENSION_IMAGES: 4,
  /** Cost for depth estimation using Depth Anything v2 */
  DEPTH_ESTIMATION: 1,
  /** Cost for Wan 2.2 video preview */
  WAN_PREVIEW: 5,
  /** Cost for regenerating dimension images (same as dimension images) */
  REGENERATION: 4,
  /** Estimated total cost for completing the full flow */
  ESTIMATED_TOTAL: 4 + 4 + 4 + 4 + 1 + 5, // 22 credits
} as const;

/**
 * Credit costs for final video generation by model
 * Used to display costs in the finalization step
 */
export const GENERATION_COSTS: Record<string, number> = {
  'sora-2': 80,
  'veo-3': 30,
  'kling-v2.1': 35,
  'luma-ray-3': 40,
  'wan-2.2': 15,
  'runway-gen4': 50,
};

// ============================================================================
// Camera Path Constants (Task 1.7)
// ============================================================================

/**
 * Camera paths for Three.js depth-based parallax rendering
 * Each path defines start and end positions for camera animation
 */
export const CAMERA_PATHS: CameraPath[] = [
  {
    id: 'static',
    label: 'Static',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
    duration: 3,
  },
  {
    id: 'pan_left',
    label: 'Pan Left',
    start: { x: 0.15, y: 0, z: 0 },
    end: { x: -0.15, y: 0, z: 0 },
    duration: 3,
  },
  {
    id: 'pan_right',
    label: 'Pan Right',
    start: { x: -0.15, y: 0, z: 0 },
    end: { x: 0.15, y: 0, z: 0 },
    duration: 3,
  },
  {
    id: 'push_in',
    label: 'Push In',
    start: { x: 0, y: 0, z: -0.1 },
    end: { x: 0, y: 0, z: 0.25 },
    duration: 3,
  },
  {
    id: 'pull_back',
    label: 'Pull Back',
    start: { x: 0, y: 0, z: 0.2 },
    end: { x: 0, y: 0, z: -0.15 },
    duration: 3,
  },
  {
    id: 'crane_up',
    label: 'Crane Up',
    start: { x: 0, y: -0.1, z: 0 },
    end: { x: 0, y: 0.15, z: 0.05 },
    duration: 3,
  },
];

// ============================================================================
// Camera Motion Descriptions (Task 1.8)
// ============================================================================

/**
 * Text descriptions for camera motions used in fallback mode
 * When depth estimation fails, these descriptions help users understand each motion
 */
export const CAMERA_MOTION_DESCRIPTIONS: Record<string, string> = {
  static: 'Camera remains fixed in place. Best for dialogue or contemplative scenes.',
  pan_left: 'Camera rotates horizontally to the left. Reveals new elements or follows action.',
  pan_right: 'Camera rotates horizontally to the right. Reveals new elements or follows action.',
  push_in: 'Camera moves forward toward subject. Creates intimacy or tension.',
  pull_back: 'Camera moves backward from subject. Reveals context or creates distance.',
  crane_up: 'Camera rises vertically. Creates grandeur or reveals overhead perspective.',
};

// ============================================================================
// Regeneration Limits
// ============================================================================

/**
 * Maximum number of regenerations allowed per dimension per session
 * Requirement 14.4: Limit regeneration to 3 times per dimension
 */
export const MAX_REGENERATIONS_PER_DIMENSION = 3;

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Session TTL in hours
 * Requirement 1.4: Sessions inactive for 24 hours are marked as abandoned
 */
export const SESSION_TTL_HOURS = 24;

/**
 * Session TTL in milliseconds
 */
export const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
