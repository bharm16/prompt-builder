import type { DimensionType, SelectionOption } from '../types';

// ============================================================================
// Option Helpers
// ============================================================================

/**
 * Default options for each dimension
 * This is a placeholder and should be replaced with actual dimension config.
 */
const DEFAULT_OPTIONS_BY_DIMENSION: Record<DimensionType | 'direction', SelectionOption[]> = {
  direction: [
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'social', label: 'Social' },
    { id: 'artistic', label: 'Artistic' },
    { id: 'documentary', label: 'Documentary' },
  ],
  mood: [
    { id: 'dramatic', label: 'Dramatic' },
    { id: 'peaceful', label: 'Peaceful' },
    { id: 'mysterious', label: 'Mysterious' },
    { id: 'nostalgic', label: 'Nostalgic' },
  ],
  framing: [
    { id: 'wide', label: 'Wide Shot' },
    { id: 'medium', label: 'Medium Shot' },
    { id: 'closeup', label: 'Close-up' },
    { id: 'extreme_closeup', label: 'Extreme Close-up' },
  ],
  lighting: [
    { id: 'golden_hour', label: 'Golden Hour' },
    { id: 'blue_hour', label: 'Blue Hour' },
    { id: 'high_key', label: 'High Key' },
    { id: 'low_key', label: 'Low Key' },
  ],
  camera_motion: [
    { id: 'static', label: 'Static' },
    { id: 'pan_left', label: 'Pan Left' },
    { id: 'pan_right', label: 'Pan Right' },
    { id: 'push_in', label: 'Push In' },
    { id: 'pull_back', label: 'Pull Back' },
    { id: 'crane_up', label: 'Crane Up' },
  ],
};

/**
 * Get options for a dimension (placeholder - should be replaced with actual dimension config)
 */
export function getOptionsForDimension(dimension: DimensionType | 'direction'): SelectionOption[] {
  return DEFAULT_OPTIONS_BY_DIMENSION[dimension] ?? [];
}
