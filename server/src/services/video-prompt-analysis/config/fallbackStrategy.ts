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
  micro: ['phrase'], // Retry a slightly broader phrase mode when micro is too strict
  default: ['phrase', 'micro'],
} as const;

/**
 * Get fallback modes for a given constraint mode
 * @param mode - Current constraint mode
 * @returns Array of fallback modes
 */
export function getFallbackModes(mode: string): string[] {
  const fallbackModes =
    FALLBACK_ORDER[mode as keyof typeof FALLBACK_ORDER] ?? FALLBACK_ORDER.default;
  return [...fallbackModes];
}
