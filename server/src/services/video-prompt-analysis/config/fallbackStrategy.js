/**
 * Fallback strategy configuration for constraint regeneration
 */

/**
 * Define fallback order based on current constraint mode
 */
export const FALLBACK_ORDER = {
  sentence: ['phrase', 'micro'],
  phrase: ['micro'],
  lighting: ['micro'],
  camera: ['micro'],
  location: ['micro'],
  style: ['micro'],
  micro: [], // No fallback for micro (already most constrained)
  default: ['phrase', 'micro'],
};

/**
 * Get fallback modes for a given constraint mode
 * @param {string} mode - Current constraint mode
 * @returns {Array} Array of fallback modes
 */
export function getFallbackModes(mode) {
  return FALLBACK_ORDER[mode] || FALLBACK_ORDER.default;
}

