/**
 * Configuration constants for span labeling
 */

/**
 * Default policy configuration for span labeling
 */
export const DEFAULT_POLICY = {
  nonTechnicalWordLimit: 6,
  allowOverlap: false,
};

/**
 * Default options for the useSpanLabeling hook
 */
export const DEFAULT_OPTIONS = {
  maxSpans: 60,
  minConfidence: 0.5,
  templateVersion: 'v1',
  debounceMs: 500, // Fallback if smart debounce is disabled
  useSmartDebounce: true, // Enable smart debouncing by default
};
