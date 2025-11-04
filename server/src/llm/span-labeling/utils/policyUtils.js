import {
  DEFAULT_POLICY,
  DEFAULT_OPTIONS,
  PERFORMANCE
} from '../config/SpanLabelingConfig.js';

/**
 * Policy and options sanitization utilities
 *
 * These functions ensure that user-provided policies and options
 * are valid, applying defaults and constraints as needed.
 */

/**
 * Sanitize and validate policy configuration
 *
 * Ensures policy has valid values with proper types and constraints.
 * Merges user policy with defaults.
 *
 * @param {Object} [policy] - Raw policy configuration
 * @returns {Object} Validated policy with defaults
 */
export function sanitizePolicy(policy = {}) {
  const merged = {
    ...DEFAULT_POLICY,
    ...(policy && typeof policy === 'object' ? policy : {}),
  };

  // Validate nonTechnicalWordLimit
  const limit = Number(merged.nonTechnicalWordLimit);
  merged.nonTechnicalWordLimit =
    Number.isFinite(limit) && limit > 0
      ? limit
      : DEFAULT_POLICY.nonTechnicalWordLimit;

  // Ensure allowOverlap is boolean
  merged.allowOverlap = merged.allowOverlap === true;

  return merged;
}

/**
 * Sanitize and validate processing options
 *
 * Ensures options have valid values with proper types and constraints.
 * Merges user options with defaults.
 *
 * @param {Object} [options] - Raw options configuration
 * @returns {Object} Validated options with defaults
 */
export function sanitizeOptions(options = {}) {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...(options && typeof options === 'object' ? options : {}),
  };

  // Validate maxSpans - must be positive integer, capped at absolute limit
  const maxSpans = Number(merged.maxSpans);
  merged.maxSpans =
    Number.isInteger(maxSpans) && maxSpans > 0
      ? Math.min(maxSpans, PERFORMANCE.MAX_SPANS_ABSOLUTE_LIMIT)
      : DEFAULT_OPTIONS.maxSpans;

  // Validate minConfidence - must be between 0 and 1
  const minConfidence = Number(merged.minConfidence);
  merged.minConfidence =
    Number.isFinite(minConfidence) &&
    minConfidence >= 0 &&
    minConfidence <= 1
      ? minConfidence
      : DEFAULT_OPTIONS.minConfidence;

  // Ensure templateVersion is string
  merged.templateVersion = String(
    merged.templateVersion || DEFAULT_OPTIONS.templateVersion
  );

  return merged;
}

/**
 * Build task description for LLM
 * @param {number} maxSpans - Maximum spans to identify
 * @returns {string} Task description
 */
export function buildTaskDescription(maxSpans) {
  return `Identify up to ${maxSpans} spans and assign roles.`;
}
