/**
 * Dimension Fragment Data for Visual Convergence
 *
 * This module contains all prompt fragments for each dimension option.
 * Fragments are combined by PromptBuilderService to construct prompts.
 *
 * Requirements:
 * - Requirement 4.1: Maintain a library of prompt fragments for each dimension option
 */

import type { Direction, DimensionConfig } from '../types';

// ============================================================================
// Direction Fragments (Task 3.1.1)
// ============================================================================

/**
 * Prompt fragments for each creative direction.
 * Each direction has 5 fragments to allow variety in selection.
 */
export const DIRECTION_FRAGMENTS: Record<Direction, string[]> = {
  cinematic: [
    'cinematic composition',
    'film-like quality',
    'dramatic framing',
    'movie production value',
    'anamorphic lens feel',
  ],
  social: [
    'social media ready',
    'vibrant and engaging',
    'eye-catching composition',
    'scroll-stopping visual',
    'high energy aesthetic',
  ],
  artistic: [
    'artistic interpretation',
    'creative visual style',
    'expressive composition',
    'aesthetic focus',
    'painterly quality',
  ],
  documentary: [
    'documentary style',
    'naturalistic look',
    'authentic atmosphere',
    'observational framing',
    'raw realism',
  ],
};

// ============================================================================
// Mood Dimension (Task 3.1.2)
// ============================================================================

/**
 * Mood dimension configuration with 4 options, 5 fragments each.
 */
export const MOOD_DIMENSION: DimensionConfig = {
  type: 'mood',
  options: [
    {
      id: 'dramatic',
      label: 'Dramatic',
      promptFragments: [
        'high contrast lighting',
        'deep shadows',
        'intense atmosphere',
        'dramatic tension',
        'bold visual statement',
      ],
    },
    {
      id: 'peaceful',
      label: 'Peaceful',
      promptFragments: [
        'soft diffused light',
        'gentle color palette',
        'serene atmosphere',
        'tranquil mood',
        'calming visual tone',
      ],
    },
    {
      id: 'mysterious',
      label: 'Mysterious',
      promptFragments: [
        'atmospheric haze',
        'obscured details',
        'enigmatic mood',
        'subtle shadows',
        'intriguing composition',
      ],
    },
    {
      id: 'nostalgic',
      label: 'Nostalgic',
      promptFragments: [
        'warm vintage tones',
        'soft focus edges',
        'memory-like quality',
        'wistful atmosphere',
        'timeless feel',
      ],
    },
  ],
};

// ============================================================================
// Framing Dimension (Task 3.1.3)
// ============================================================================

/**
 * Framing dimension configuration with 4 options, 5 fragments each.
 */
export const FRAMING_DIMENSION: DimensionConfig = {
  type: 'framing',
  options: [
    {
      id: 'wide',
      label: 'Wide Shot',
      promptFragments: [
        'wide establishing shot',
        'environment visible',
        'subject in context',
        'expansive framing',
        'full scene coverage',
      ],
    },
    {
      id: 'medium',
      label: 'Medium Shot',
      promptFragments: [
        'medium shot framing',
        'waist-up framing',
        'balanced composition',
        'conversational distance',
        'natural perspective',
      ],
    },
    {
      id: 'closeup',
      label: 'Close-up',
      promptFragments: [
        'intimate close-up shot',
        'shallow depth of field',
        'face fills frame',
        'detailed features visible',
        'emotional proximity',
      ],
    },
    {
      id: 'extreme_closeup',
      label: 'Extreme Close-up',
      promptFragments: [
        'extreme close-up detail',
        'macro-like framing',
        'texture emphasis',
        'ultra shallow focus',
        'abstract detail shot',
      ],
    },
  ],
};

// ============================================================================
// Lighting Dimension (Task 3.1.4)
// ============================================================================

/**
 * Lighting dimension configuration with 4 options, 5 fragments each.
 */
export const LIGHTING_DIMENSION: DimensionConfig = {
  type: 'lighting',
  options: [
    {
      id: 'golden_hour',
      label: 'Golden Hour',
      promptFragments: [
        'warm golden hour sunlight',
        'long shadows',
        'orange and amber tones',
        'soft directional light',
        'magic hour glow',
      ],
    },
    {
      id: 'blue_hour',
      label: 'Blue Hour',
      promptFragments: [
        'cool blue hour light',
        'twilight atmosphere',
        'soft ambient illumination',
        'blue and purple tones',
        'ethereal dusk lighting',
      ],
    },
    {
      id: 'high_key',
      label: 'High Key',
      promptFragments: [
        'bright high-key lighting',
        'minimal shadows',
        'clean bright aesthetic',
        'even illumination',
        'airy light quality',
      ],
    },
    {
      id: 'low_key',
      label: 'Low Key',
      promptFragments: [
        'dramatic low-key lighting',
        'deep blacks',
        'selective illumination',
        'chiaroscuro effect',
        'moody shadow play',
      ],
    },
  ],
};

// ============================================================================
// Camera Motion Dimension (Task 3.1.5)
// ============================================================================

/**
 * Camera motion dimension configuration with 6 options, 3 fragments each.
 * Note: Camera motion fragments are excluded from image generation prompts
 * per Requirement 4.4, but are used for video generation.
 */
export const CAMERA_MOTION_DIMENSION: DimensionConfig = {
  type: 'camera_motion',
  options: [
    {
      id: 'static',
      label: 'Static',
      promptFragments: ['locked off camera', 'stable tripod shot', 'no camera movement'],
    },
    {
      id: 'pan_left',
      label: 'Pan Left',
      promptFragments: ['camera pans left', 'horizontal pan movement', 'smooth lateral tracking'],
    },
    {
      id: 'pan_right',
      label: 'Pan Right',
      promptFragments: ['camera pans right', 'horizontal pan movement', 'smooth lateral tracking'],
    },
    {
      id: 'push_in',
      label: 'Push In',
      promptFragments: ['camera pushes in slowly', 'dolly forward movement', 'increasing intimacy'],
    },
    {
      id: 'pull_back',
      label: 'Pull Back',
      promptFragments: ['camera pulls back', 'dolly backward movement', 'revealing wider context'],
    },
    {
      id: 'crane_up',
      label: 'Crane Up',
      promptFragments: ['camera cranes upward', 'vertical ascending movement', 'elevated perspective reveal'],
    },
  ],
};

// ============================================================================
// Dimension Lookup Utilities
// ============================================================================

/**
 * All dimension configurations for easy lookup.
 */
export const ALL_DIMENSIONS: DimensionConfig[] = [
  MOOD_DIMENSION,
  FRAMING_DIMENSION,
  LIGHTING_DIMENSION,
  CAMERA_MOTION_DIMENSION,
];

/**
 * Get a dimension configuration by type.
 */
export function getDimensionConfig(type: string): DimensionConfig | undefined {
  return ALL_DIMENSIONS.find((d) => d.type === type);
}

/**
 * Get a dimension option by type and option ID.
 */
export function getDimensionOption(
  type: string,
  optionId: string
): { id: string; label: string; promptFragments: string[] } | undefined {
  const dimension = getDimensionConfig(type);
  return dimension?.options.find((o) => o.id === optionId);
}

/**
 * Get direction fragments by direction type.
 */
export function getDirectionFragments(direction: Direction): string[] {
  return DIRECTION_FRAGMENTS[direction] ?? [];
}
