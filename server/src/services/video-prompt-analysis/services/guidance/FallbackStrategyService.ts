import { logger } from '@infrastructure/Logger';
import { getFallbackModes } from '@services/video-prompt-analysis/config/fallbackStrategy';
import type { ConstraintConfig, ConstraintDetails, ConstraintOptions } from '@services/video-prompt-analysis/types';

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
    // Determine current mode (use 'default' if null/undefined)
    const currentMode = currentConstraints?.mode ?? 'default';

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

