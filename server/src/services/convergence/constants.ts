/**
 * Constants for the Visual Convergence feature
 */

import type { CameraPath, Direction } from './types';

// ============================================================================
// Direction Options (Task 1.5)
// ============================================================================

/**
 * Default aspect ratio for generated images
 */
export const DEFAULT_ASPECT_RATIO = '16:9';

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
  /** Cost for generating HQ final frame (Flux Pro) */
  FINAL_FRAME_HQ: 2,
  /** Cost for regenerating the HQ final frame */
  FINAL_FRAME_REGENERATE: 2,
  /** Cost for quick generate mode (single HQ image) */
  QUICK_GENERATE: 2,
  /** Cost for depth estimation using Depth Anything v2 */
  DEPTH_ESTIMATION: 1,
  /** Cost for Wan 2.2 video preview */
  WAN_PREVIEW: 5,
  /** Cost for regenerating dimension images (same as dimension images) */
  REGENERATION: 4,
  /** Estimated total cost for completing the full flow */
  ESTIMATED_TOTAL: 4 + 4 + 4 + 4 + 2 + 1 + 5, // 24 credits
} as const;

/**
 * Max number of allowed regenerations for the final frame
 */
export const MAX_FINAL_FRAME_REGENERATIONS = 3;

/**
 * Image generation providers for previews and HQ frames
 */
export const PREVIEW_PROVIDER = 'replicate-flux-schnell';
export const FINAL_FRAME_PROVIDER = 'replicate-flux-pro';

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
  'wan-2.5': 15,
  'runway-gen4': 50,
};

// ============================================================================
// Camera Path Constants (Task 1.7)
// ============================================================================

/**
 * Default rotation (no rotation)
 */
const NO_ROTATION = { pitch: 0, yaw: 0, roll: 0 };

/**
 * Camera paths for Three.js depth-based parallax rendering
 * Each path defines start and end transforms (position + rotation) for camera animation
 * 
 * Movement types:
 * - Pan/Tilt: Camera rotates while staying in place
 * - Dutch: Camera rolls to create tilted horizon
 * - Dolly/Track: Camera translates horizontally or in depth
 * - Pedestal/Crane: Camera translates vertically (with optional tilt)
 * - Arc: Camera orbits around the subject
 * - Reveal: Combined push and pan
 */
export const CAMERA_PATHS: CameraPath[] = [
  // STATIC (1)
  {
    id: 'static',
    label: 'Static',
    category: 'static',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: NO_ROTATION },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: NO_ROTATION },
    duration: 3,
  },

  // PAN/TILT (6)
  {
    id: 'pan_left',
    label: 'Pan Left',
    category: 'pan_tilt',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0.25, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: -0.25, roll: 0 } },
    duration: 3,
  },
  {
    id: 'pan_right',
    label: 'Pan Right',
    category: 'pan_tilt',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: -0.25, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0.25, roll: 0 } },
    duration: 3,
  },
  {
    id: 'tilt_up',
    label: 'Tilt Up',
    category: 'pan_tilt',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: -0.2, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0.15, yaw: 0, roll: 0 } },
    duration: 3,
  },
  {
    id: 'tilt_down',
    label: 'Tilt Down',
    category: 'pan_tilt',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0.15, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: -0.2, yaw: 0, roll: 0 } },
    duration: 3,
  },
  {
    id: 'dutch_left',
    label: 'Dutch Left',
    category: 'pan_tilt',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0, roll: -0.18 } },
    duration: 3,
  },
  {
    id: 'dutch_right',
    label: 'Dutch Right',
    category: 'pan_tilt',
    start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0, roll: 0.18 } },
    duration: 3,
  },

  // DOLLY (4)
  {
    id: 'push_in',
    label: 'Push In',
    category: 'dolly',
    start: { position: { x: 0, y: 0, z: -0.1 }, rotation: NO_ROTATION },
    end: { position: { x: 0, y: 0, z: 0.25 }, rotation: NO_ROTATION },
    duration: 3,
  },
  {
    id: 'pull_back',
    label: 'Pull Back',
    category: 'dolly',
    start: { position: { x: 0, y: 0, z: 0.2 }, rotation: NO_ROTATION },
    end: { position: { x: 0, y: 0, z: -0.15 }, rotation: NO_ROTATION },
    duration: 3,
  },
  {
    id: 'track_left',
    label: 'Track Left',
    category: 'dolly',
    start: { position: { x: 0.15, y: 0, z: 0 }, rotation: NO_ROTATION },
    end: { position: { x: -0.15, y: 0, z: 0 }, rotation: NO_ROTATION },
    duration: 3,
  },
  {
    id: 'track_right',
    label: 'Track Right',
    category: 'dolly',
    start: { position: { x: -0.15, y: 0, z: 0 }, rotation: NO_ROTATION },
    end: { position: { x: 0.15, y: 0, z: 0 }, rotation: NO_ROTATION },
    duration: 3,
  },

  // CRANE (4)
  {
    id: 'pedestal_up',
    label: 'Pedestal Up',
    category: 'crane',
    start: { position: { x: 0, y: -0.15, z: 0 }, rotation: NO_ROTATION },
    end: { position: { x: 0, y: 0.15, z: 0 }, rotation: NO_ROTATION },
    duration: 3,
  },
  {
    id: 'pedestal_down',
    label: 'Pedestal Down',
    category: 'crane',
    start: { position: { x: 0, y: 0.15, z: 0 }, rotation: NO_ROTATION },
    end: { position: { x: 0, y: -0.15, z: 0 }, rotation: NO_ROTATION },
    duration: 3,
  },
  {
    id: 'crane_up',
    label: 'Crane Up',
    category: 'crane',
    start: { position: { x: 0, y: -0.1, z: 0 }, rotation: { pitch: -0.1, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: 0.15, z: 0.05 }, rotation: { pitch: 0.05, yaw: 0, roll: 0 } },
    duration: 3,
  },
  {
    id: 'crane_down',
    label: 'Crane Down',
    category: 'crane',
    start: { position: { x: 0, y: 0.15, z: 0.05 }, rotation: { pitch: 0.05, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: -0.1, z: 0 }, rotation: { pitch: -0.1, yaw: 0, roll: 0 } },
    duration: 3,
  },

  // ORBITAL (2)
  {
    id: 'arc_left',
    label: 'Arc Left',
    category: 'orbital',
    start: { position: { x: 0.2, y: 0, z: 0.1 }, rotation: { pitch: 0, yaw: -0.15, roll: 0 } },
    end: { position: { x: -0.2, y: 0, z: 0.1 }, rotation: { pitch: 0, yaw: 0.15, roll: 0 } },
    duration: 3,
  },
  {
    id: 'arc_right',
    label: 'Arc Right',
    category: 'orbital',
    start: { position: { x: -0.2, y: 0, z: 0.1 }, rotation: { pitch: 0, yaw: 0.15, roll: 0 } },
    end: { position: { x: 0.2, y: 0, z: 0.1 }, rotation: { pitch: 0, yaw: -0.15, roll: 0 } },
    duration: 3,
  },

  // COMPOUND (1)
  {
    id: 'reveal',
    label: 'Reveal',
    category: 'compound',
    start: { position: { x: -0.1, y: 0, z: -0.1 }, rotation: { pitch: 0, yaw: -0.15, roll: 0 } },
    end: { position: { x: 0.05, y: 0, z: 0.15 }, rotation: { pitch: 0, yaw: 0.1, roll: 0 } },
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
  static: 'Camera remains fixed. Best for dialogue or contemplative scenes.',
  pan_left: 'Camera rotates left while staying in place. Reveals new elements.',
  pan_right: 'Camera rotates right while staying in place. Reveals new elements.',
  tilt_up: 'Camera tilts upward. Reveals height or creates awe.',
  tilt_down: 'Camera tilts downward. Creates introspection or reveals ground.',
  dutch_left: 'Camera rolls left for tilted horizon. Adds tension or unease.',
  dutch_right: 'Camera rolls right for tilted horizon. Adds tension or unease.',
  push_in: 'Camera moves toward subject. Creates intimacy or tension.',
  pull_back: 'Camera moves away from subject. Reveals context or creates distance.',
  track_left: 'Camera slides left. Follows action or reveals scene laterally.',
  track_right: 'Camera slides right. Follows action or reveals scene laterally.',
  pedestal_up: 'Camera rises vertically. Reveals overhead perspective.',
  pedestal_down: 'Camera lowers vertically. Grounds the viewer.',
  crane_up: 'Camera rises with subtle tilt. Creates grandeur.',
  crane_down: 'Camera descends with subtle tilt. Creates intimacy.',
  arc_left: 'Camera orbits left around subject. Dynamic perspective shift.',
  arc_right: 'Camera orbits right around subject. Dynamic perspective shift.',
  reveal: 'Combined push and pan. Builds anticipation for dramatic reveal.',
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
