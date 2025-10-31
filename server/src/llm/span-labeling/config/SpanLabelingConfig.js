/**
 * Centralized configuration for span labeling
 *
 * All constants and defaults extracted from spanLabeler.js
 * This makes it easy to tune performance and behavior without
 * touching the core logic.
 */

/**
 * Performance and capacity constants
 */
export const PERFORMANCE = {
  // Hard upper bound to prevent excessive processing
  MAX_SPANS_ABSOLUTE_LIMIT: 80,

  // Conservative default for response generation
  DEFAULT_MAX_TOKENS: 800,

  // Base tokens for response structure (JSON overhead)
  TOKEN_ESTIMATION_BASE: 400,

  // Average tokens per span in response
  TOKEN_ESTIMATION_PER_SPAN: 25,

  // Absolute maximum tokens for any response
  MAX_TOKEN_RESPONSE_LIMIT: 4000,
};

/**
 * Default validation policy
 */
export const DEFAULT_POLICY = {
  // Maximum word count for non-technical spans
  nonTechnicalWordLimit: 6,

  // Whether to allow overlapping spans
  allowOverlap: false,
};

/**
 * Default processing options
 */
export const DEFAULT_OPTIONS = {
  // Maximum number of spans to return
  maxSpans: 60,

  // Minimum confidence threshold (0-1)
  minConfidence: 0.5,

  // Template version identifier
  templateVersion: 'v1',
};

/**
 * Default confidence value for uncertain spans
 */
export const DEFAULT_CONFIDENCE = 0.7;

/**
 * LLM model configuration
 */
export const MODEL_CONFIG = {
  // Temperature for span labeling (0 = deterministic)
  temperature: 0,

  // Default timeout for LLM calls (ms)
  timeout: 30000,
};

/**
 * Validation modes
 */
export const VALIDATION_MODES = {
  // Strict validation - fails on any error
  STRICT: 1,

  // Lenient validation - drops invalid spans instead of failing
  LENIENT: 2,
};

/**
 * Get estimated max tokens for a given number of spans
 * @param {number} maxSpans - Maximum spans requested
 * @returns {number} Estimated max tokens needed
 */
export function estimateMaxTokens(maxSpans) {
  const estimated = PERFORMANCE.TOKEN_ESTIMATION_BASE +
                   (maxSpans * PERFORMANCE.TOKEN_ESTIMATION_PER_SPAN);
  return Math.min(PERFORMANCE.MAX_TOKEN_RESPONSE_LIMIT, estimated);
}

/**
 * Configuration export
 */
const SpanLabelingConfig = {
  PERFORMANCE,
  DEFAULT_POLICY,
  DEFAULT_OPTIONS,
  DEFAULT_CONFIDENCE,
  MODEL_CONFIG,
  VALIDATION_MODES,
  estimateMaxTokens,
};

export default SpanLabelingConfig;
