import { logger } from '@infrastructure/Logger';
import { getFallbackModes } from '../../config/fallbackStrategy.js';
import type { ConstraintConfig, ConstraintDetails, ConstraintOptions } from '../../types.js';

/**
 * Service responsible for determining fallback constraints when suggestions fail
 */
export class FallbackStrategyService {
  private readonly log = logger.child({ service: 'FallbackStrategyService' });

  /**
   * Determine the next fallback constraint mode to try
   */
  getVideoFallbackConstraints(
    currentConstraints: ConstraintConfig | null | undefined,
    details: ConstraintDetails = {},
    attemptedModes: Set<string> = new Set(),
    getConstraintsFn: (details: ConstraintDetails, options: ConstraintOptions) => ConstraintConfig
  ): ConstraintConfig | null {
    // Determine current mode
    const currentMode = currentConstraints?.mode || null;

    // Get fallback order for current mode
    const fallbackOrder = getFallbackModes(currentMode);

    // Find first unattempted mode
    for (const mode of fallbackOrder) {
      if (attemptedModes.has(mode)) {
        continue;
      }

      // Generate constraints for this fallback mode
      return getConstraintsFn(details, { forceMode: mode });
    }

    // No more fallbacks available
    return null;
  }
}

