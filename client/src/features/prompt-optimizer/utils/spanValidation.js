/**
 * Span Validation Utilities
 * 
 * Pure functions for validating and sanitizing span data.
 * Extracted from useEnhancementSuggestions.js to eliminate duplication.
 * 
 * Architecture: Pure utility functions (no dependencies)
 * Pattern: Single responsibility - validation only
 * Line count: ~45 lines (within <100 limit for utils)
 */

/**
 * Check if a span object is valid
 * @param {Object} span - Span to validate
 * @returns {boolean} True if span is valid
 */
export function isValidSpan(span) {
  if (!span || typeof span !== 'object') {
    return false;
  }
  
  const text = span.quote || span.text || '';
  return typeof text === 'string' && text.trim().length > 0;
}

/**
 * Filter array of spans to only valid ones
 * @param {Array} spans - Array of spans to sanitize
 * @returns {Array} Filtered array of valid spans
 */
export function sanitizeSpans(spans) {
  if (!Array.isArray(spans)) {
    return [];
  }
  
  return spans.filter(isValidSpan);
}

/**
 * Validate and normalize a span to standard format
 * @param {Object} span - Span to normalize
 * @returns {Object|null} Normalized span or null if invalid
 */
export function normalizeSpan(span) {
  if (!isValidSpan(span)) {
    return null;
  }
  
  const text = (span.quote || span.text || '').trim();
  
  return {
    text,
    role: span.role || span.category || 'unknown',
    category: span.category || span.role || 'unknown',
    confidence: span.confidence,
    start: span.start,
    end: span.end,
  };
}

