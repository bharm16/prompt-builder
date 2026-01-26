/**
 * Prompt Builder Module
 *
 * This module provides prompt construction services for the Visual Convergence feature.
 * It combines user intent with dimension fragments to create coherent prompts.
 *
 * @module prompt-builder
 */

// Dimension Fragments
export {
  DIRECTION_FRAGMENTS,
  MOOD_DIMENSION,
  FRAMING_DIMENSION,
  LIGHTING_DIMENSION,
  CAMERA_MOTION_DIMENSION,
  ALL_DIMENSIONS,
  getDimensionConfig,
  getDimensionOption,
  getDirectionFragments,
} from './DimensionFragments';

// Prompt Builder Service
export {
  PromptBuilderService,
  getPromptBuilderService,
} from './PromptBuilderService';

export type {
  PromptBuildOptions,
  PreviewDimension,
  DirectionPromptResult,
} from './PromptBuilderService';
