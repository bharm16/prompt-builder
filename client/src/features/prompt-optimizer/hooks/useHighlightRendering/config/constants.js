/**
 * useHighlightRendering Constants
 * 
 * Configuration values for highlight rendering.
 */

// Debug flag for highlight logging
export const DEBUG_HIGHLIGHTS = true;

// Performance marks
export const PERFORMANCE_MARKS = {
  HIGHLIGHTS_VISIBLE: 'highlights-visible-on-screen',
  PROMPT_DISPLAYED: 'prompt-displayed-on-screen',
};

// Performance measures
export const PERFORMANCE_MEASURES = {
  PROMPT_TO_HIGHLIGHTS: 'CRITICAL-prompt-to-highlights',
};

// Dataset keys for highlight elements
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

