import { getFallbackModes } from '../../config/fallbackStrategy.js';

/**
 * Service responsible for determining fallback constraints when suggestions fail
 */
export class FallbackStrategyService {
  /**
   * Determine the next fallback constraint mode to try
   * @param {Object} currentConstraints - Current constraint configuration
   * @param {Object} details - Details about the highlight
   * @param {Set} attemptedModes - Set of already attempted modes
   * @param {Function} getConstraintsFn - Function to get constraints for a mode
   * @returns {Object|null} Next fallback constraints or null
   */
  getVideoFallbackConstraints(
    currentConstraints,
    details = {},
    attemptedModes = new Set(),
    getConstraintsFn
  ) {
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

