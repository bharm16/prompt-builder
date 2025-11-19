/**
 * Configuration Constants
 * Unified constants for span labeling and highlighting
 */

// ============================================================================
// SPAN LABELING CONSTANTS
// ============================================================================

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

// ============================================================================
// HIGHLIGHT RENDERING CONSTANTS
// ============================================================================

/**
 * Debug flag for highlight logging
 */
export const DEBUG_HIGHLIGHTS = true;

/**
 * Performance marks for highlight rendering
 */
export const PERFORMANCE_MARKS = {
  HIGHLIGHTS_VISIBLE: 'highlights-visible-on-screen',
  PROMPT_DISPLAYED: 'prompt-displayed-on-screen',
};

/**
 * Performance measures for highlight rendering
 */
export const PERFORMANCE_MEASURES = {
  PROMPT_TO_HIGHLIGHTS: 'CRITICAL-prompt-to-highlights',
};

/**
 * Dataset keys for highlight elements
 */
export const DATASET_KEYS = {
  CATEGORY: 'category',
  SOURCE: 'source',
  SPAN_ID: 'spanId',
  START: 'start',
  END: 'end',
  START_DISPLAY: 'startDisplay',
  END_DISPLAY: 'endDisplay',
  START_GRAPHEME: 'startGrapheme',
  END_GRAPHEME: 'endGrapheme',
  VALIDATOR_PASS: 'validatorPass',
  IDEMPOTENCY_KEY: 'idempotencyKey',
  QUOTE: 'quote',
  LEFT_CTX: 'leftCtx',
  RIGHT_CTX: 'rightCtx',
  DISPLAY_QUOTE: 'displayQuote',
  DISPLAY_LEFT_CTX: 'displayLeftCtx',
  DISPLAY_RIGHT_CTX: 'displayRightCtx',
  CONFIDENCE: 'confidence',
};

