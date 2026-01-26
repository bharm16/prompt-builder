/**
 * PromptBuilderService
 *
 * Constructs prompts from dimension selections using the fragment library.
 * This service is responsible for combining user intent with direction and
 * dimension fragments to create coherent prompts for image/video generation.
 *
 * Requirements:
 * - Requirement 4.1: Maintain a library of prompt fragments for each dimension option
 * - Requirement 4.2: Full prompt combines: intent, direction fragments (2), locked dimension fragments (2 each), and subject motion
 * - Requirement 4.3: Preview prompt emphasizes preview dimension with 2 fragments while using 1 fragment for locked dimensions
 * - Requirement 4.4: Exclude camera_motion fragments from image generation prompts
 */

import type { Direction, LockedDimension } from '../types';
import { DIRECTION_FRAGMENTS, getDirectionFragments } from './DimensionFragments';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for building a full prompt.
 */
export interface PromptBuildOptions {
  intent: string;
  direction: Direction;
  lockedDimensions: LockedDimension[];
  subjectMotion?: string;
}

/**
 * Preview dimension information for building preview prompts.
 */
export interface PreviewDimension {
  type: string;
  optionId: string;
  fragments: string[];
}

/**
 * Result of building direction prompts.
 */
export interface DirectionPromptResult {
  direction: Direction;
  prompt: string;
}

// ============================================================================
// Fragment Selection Utilities
// ============================================================================

/**
 * Randomly select N fragments from an array.
 * Uses Fisher-Yates shuffle for unbiased selection.
 *
 * @param fragments - Array of fragments to select from
 * @param count - Number of fragments to select
 * @returns Selected fragments
 */
function selectRandomFragments(fragments: string[], count: number): string[] {
  if (fragments.length <= count) {
    return [...fragments];
  }

  // Create a copy to avoid mutating the original
  const shuffled = [...fragments];

  // Fisher-Yates shuffle (partial - only shuffle first 'count' elements)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (shuffled.length - i));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }

  return shuffled.slice(0, count);
}

/**
 * Select the first N fragments from an array (deterministic selection).
 *
 * @param fragments - Array of fragments to select from
 * @param count - Number of fragments to select
 * @returns Selected fragments
 */
function selectFirstFragments(fragments: string[], count: number): string[] {
  return fragments.slice(0, count);
}

// ============================================================================
// PromptBuilderService
// ============================================================================

/**
 * Service for constructing prompts from dimension selections.
 */
export class PromptBuilderService {
  /**
   * Number of direction fragments to include in prompts.
   */
  private static readonly DIRECTION_FRAGMENT_COUNT = 2;

  /**
   * Number of dimension fragments to include in full prompts.
   */
  private static readonly DIMENSION_FRAGMENT_COUNT = 2;

  /**
   * Number of dimension fragments for locked dimensions in preview prompts.
   */
  private static readonly PREVIEW_LOCKED_FRAGMENT_COUNT = 1;

  /**
   * Number of fragments for the preview dimension (emphasized).
   */
  private static readonly PREVIEW_EMPHASIS_FRAGMENT_COUNT = 2;

  /**
   * Build a full prompt combining intent, direction, locked dimensions, and subject motion.
   *
   * Requirement 4.2: Full prompt combines: intent, direction fragments (2),
   * locked dimension fragments (2 each), and subject motion.
   *
   * Requirement 4.4: Exclude camera_motion fragments from image generation prompts.
   *
   * @param options - Prompt build options
   * @returns Complete prompt string
   */
  buildPrompt(options: PromptBuildOptions): string {
    const { intent, direction, lockedDimensions, subjectMotion } = options;

    const parts: string[] = [];

    // 1. Start with user intent
    parts.push(intent);

    // 2. Add direction fragments (2)
    const directionFragments = getDirectionFragments(direction);
    const selectedDirectionFragments = selectFirstFragments(
      directionFragments,
      PromptBuilderService.DIRECTION_FRAGMENT_COUNT
    );
    parts.push(...selectedDirectionFragments);

    // 3. Add locked dimension fragments (2 each), excluding camera_motion
    for (const dimension of lockedDimensions) {
      // Requirement 4.4: Exclude camera_motion fragments from image generation prompts
      if (dimension.type === 'camera_motion') {
        continue;
      }

      const selectedFragments = selectFirstFragments(
        dimension.promptFragments,
        PromptBuilderService.DIMENSION_FRAGMENT_COUNT
      );
      parts.push(...selectedFragments);
    }

    // 4. Add subject motion if provided
    if (subjectMotion && subjectMotion.trim()) {
      parts.push(subjectMotion.trim());
    }

    // Join all parts with commas
    return parts.join(', ');
  }

  /**
   * Build a preview prompt that emphasizes the preview dimension.
   *
   * Requirement 4.3: Preview prompt emphasizes preview dimension with 2 fragments
   * while using 1 fragment for locked dimensions.
   *
   * Requirement 4.4: Exclude camera_motion fragments from image generation prompts.
   *
   * @param intent - User's original intent
   * @param direction - Selected creative direction
   * @param lockedDimensions - Previously locked dimensions
   * @param previewDimension - The dimension being previewed (emphasized)
   * @returns Preview prompt string
   */
  buildDimensionPreviewPrompt(
    intent: string,
    direction: Direction,
    lockedDimensions: LockedDimension[],
    previewDimension: PreviewDimension
  ): string {
    const parts: string[] = [];

    // 1. Start with user intent
    parts.push(intent);

    // 2. Add direction fragments (2)
    const directionFragments = getDirectionFragments(direction);
    const selectedDirectionFragments = selectFirstFragments(
      directionFragments,
      PromptBuilderService.DIRECTION_FRAGMENT_COUNT
    );
    parts.push(...selectedDirectionFragments);

    // 3. Add locked dimension fragments (1 each for de-emphasis), excluding camera_motion
    for (const dimension of lockedDimensions) {
      // Requirement 4.4: Exclude camera_motion fragments
      if (dimension.type === 'camera_motion') {
        continue;
      }

      const selectedFragments = selectFirstFragments(
        dimension.promptFragments,
        PromptBuilderService.PREVIEW_LOCKED_FRAGMENT_COUNT
      );
      parts.push(...selectedFragments);
    }

    // 4. Add preview dimension fragments (2 for emphasis)
    // Requirement 4.4: Don't add camera_motion fragments to image prompts
    if (previewDimension.type !== 'camera_motion') {
      const selectedPreviewFragments = selectFirstFragments(
        previewDimension.fragments,
        PromptBuilderService.PREVIEW_EMPHASIS_FRAGMENT_COUNT
      );
      parts.push(...selectedPreviewFragments);
    }

    // Join all parts with commas
    return parts.join(', ');
  }

  /**
   * Build prompts for the direction fork (4 prompts, one per direction).
   *
   * This is used at the start of the convergence flow to generate
   * one image per direction option.
   *
   * @param intent - User's original intent
   * @returns Array of direction prompts with their associated direction
   */
  buildDirectionPrompts(intent: string): DirectionPromptResult[] {
    const directions: Direction[] = ['cinematic', 'social', 'artistic', 'documentary'];

    return directions.map((direction) => {
      const fragments = getDirectionFragments(direction);
      const selectedFragments = selectFirstFragments(
        fragments,
        PromptBuilderService.DIRECTION_FRAGMENT_COUNT
      );

      // Combine intent with direction fragments
      const prompt = [intent, ...selectedFragments].join(', ');

      return {
        direction,
        prompt,
      };
    });
  }

  /**
   * Build prompts for regeneration with shuffled fragment selection.
   *
   * Requirement 14.3: When regenerating, shuffle which 2 of 5 prompt fragments
   * are selected, and MAY add a random seed modifier.
   *
   * @param options - Prompt build options
   * @returns Complete prompt string with shuffled fragments
   */
  buildRegeneratedPrompt(options: PromptBuildOptions): string {
    const { intent, direction, lockedDimensions, subjectMotion } = options;

    const parts: string[] = [];

    // 1. Start with user intent
    parts.push(intent);

    // 2. Add direction fragments (2, randomly selected)
    const directionFragments = getDirectionFragments(direction);
    const selectedDirectionFragments = selectRandomFragments(
      directionFragments,
      PromptBuilderService.DIRECTION_FRAGMENT_COUNT
    );
    parts.push(...selectedDirectionFragments);

    // 3. Add locked dimension fragments (2 each, randomly selected), excluding camera_motion
    for (const dimension of lockedDimensions) {
      if (dimension.type === 'camera_motion') {
        continue;
      }

      const selectedFragments = selectRandomFragments(
        dimension.promptFragments,
        PromptBuilderService.DIMENSION_FRAGMENT_COUNT
      );
      parts.push(...selectedFragments);
    }

    // 4. Add subject motion if provided
    if (subjectMotion && subjectMotion.trim()) {
      parts.push(subjectMotion.trim());
    }

    // Join all parts with commas
    return parts.join(', ');
  }

  /**
   * Build a regenerated preview prompt with shuffled fragment selection.
   *
   * @param intent - User's original intent
   * @param direction - Selected creative direction
   * @param lockedDimensions - Previously locked dimensions
   * @param previewDimension - The dimension being previewed (emphasized)
   * @returns Preview prompt string with shuffled fragments
   */
  buildRegeneratedDimensionPreviewPrompt(
    intent: string,
    direction: Direction,
    lockedDimensions: LockedDimension[],
    previewDimension: PreviewDimension
  ): string {
    const parts: string[] = [];

    // 1. Start with user intent
    parts.push(intent);

    // 2. Add direction fragments (2, randomly selected)
    const directionFragments = getDirectionFragments(direction);
    const selectedDirectionFragments = selectRandomFragments(
      directionFragments,
      PromptBuilderService.DIRECTION_FRAGMENT_COUNT
    );
    parts.push(...selectedDirectionFragments);

    // 3. Add locked dimension fragments (1 each, randomly selected), excluding camera_motion
    for (const dimension of lockedDimensions) {
      if (dimension.type === 'camera_motion') {
        continue;
      }

      const selectedFragments = selectRandomFragments(
        dimension.promptFragments,
        PromptBuilderService.PREVIEW_LOCKED_FRAGMENT_COUNT
      );
      parts.push(...selectedFragments);
    }

    // 4. Add preview dimension fragments (2, randomly selected for emphasis)
    if (previewDimension.type !== 'camera_motion') {
      const selectedPreviewFragments = selectRandomFragments(
        previewDimension.fragments,
        PromptBuilderService.PREVIEW_EMPHASIS_FRAGMENT_COUNT
      );
      parts.push(...selectedPreviewFragments);
    }

    // Join all parts with commas
    return parts.join(', ');
  }

  /**
   * Build regenerated direction prompts with shuffled fragment selection.
   *
   * @param intent - User's original intent
   * @returns Array of direction prompts with shuffled fragments
   */
  buildRegeneratedDirectionPrompts(intent: string): DirectionPromptResult[] {
    const directions: Direction[] = ['cinematic', 'social', 'artistic', 'documentary'];

    return directions.map((direction) => {
      const fragments = getDirectionFragments(direction);
      const selectedFragments = selectRandomFragments(
        fragments,
        PromptBuilderService.DIRECTION_FRAGMENT_COUNT
      );

      const prompt = [intent, ...selectedFragments].join(', ');

      return {
        direction,
        prompt,
      };
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let promptBuilderInstance: PromptBuilderService | null = null;

/**
 * Get the singleton PromptBuilderService instance.
 */
export function getPromptBuilderService(): PromptBuilderService {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilderService();
  }
  return promptBuilderInstance;
}
