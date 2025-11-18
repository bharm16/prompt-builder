import { ROLE_SET } from '../config/roles.js';
import { clamp01 } from '../utils/textUtils.js';

/**
 * Span normalization module
 *
 * Responsible for normalizing role values and confidence scores.
 * Applies validation rules and defaults for invalid values.
 */

/**
 * Normalize a single span's role and confidence
 *
 * In strict mode (lenient=false), returns null for invalid roles.
 * In lenient mode (lenient=true), assigns 'Quality' for invalid roles.
 *
 * @param {Object} span - The span to normalize
 * @param {string} span.text - Span text
 * @param {number} span.start - Start position
 * @param {number} span.end - End position
 * @param {string} span.role - Role to validate
 * @param {number} span.confidence - Confidence to clamp
 * @param {boolean} lenient - If true, assigns 'Quality' for invalid roles; if false, returns null
 * @returns {Object|null} Normalized span with role and confidence, or null if invalid
 */
export function normalizeSpan(span, lenient = false) {
  const confidence = clamp01(span.confidence);

  // Validate role
  const role =
    typeof span.role === 'string' && ROLE_SET.has(span.role)
      ? span.role
      : lenient
        ? 'Quality'
        : null;

  // Return null if role is invalid in strict mode
  if (role === null) {
    return null;
  }

  return {
    text: span.text,
    start: span.start,
    end: span.end,
    role,
    confidence,
  };
}
