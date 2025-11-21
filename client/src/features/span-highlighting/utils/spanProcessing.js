/**
 * Span Processing Utilities
 * 
 * Business logic for processing labeled spans.
 * Extracted from useEnhancementSuggestions.js.
 * 
 * Architecture: Pure utility functions
 * Pattern: Single responsibility - span processing logic
 * Line count: ~95 lines (within <100 limit for utils)
 */

import { sanitizeSpans, normalizeSpan } from './spanValidation.js';

/**
 * Find spans that are near the selected text
 * @param {Object} metadata - Metadata for selected span
 * @param {Array} allSpans - All labeled spans
 * @param {number} threshold - Distance threshold in characters
 * @returns {Array} Nearby spans with distance info
 */
export function findNearbySpans(metadata, allSpans, threshold = 100) {
  if (!metadata || !Array.isArray(allSpans) || allSpans.length === 0) {
    return [];
  }

  const selectedStart = metadata.start ?? -1;
  const selectedEnd = metadata.end ?? -1;

  if (selectedStart < 0 || selectedEnd < 0) {
    return [];
  }

  return allSpans
    .filter((span) => {
      // Don't include the selected span itself
      if (span.start === selectedStart && span.end === selectedEnd) {
        return false;
      }

      // Calculate distance
      const distanceBefore = selectedStart - span.end;
      const distanceAfter = span.start - selectedEnd;

      // Include if within threshold (before or after)
      return (distanceBefore >= 0 && distanceBefore <= threshold) ||
             (distanceAfter >= 0 && distanceAfter <= threshold);
    })
    .map((span) => {
      // Calculate exact distance
      const distanceBefore = selectedStart - span.end;
      const distanceAfter = span.start - selectedEnd;
      const distance = distanceBefore >= 0 ? distanceBefore : distanceAfter;
      const position = distanceBefore >= 0 ? 'before' : 'after';

      return {
        text: (span.quote || span.text || '').trim(),
        role: span.role || span.category || 'unknown',
        category: span.category || span.role || 'unknown',
        confidence: span.confidence,
        distance,
        position,
        start: span.start,
        end: span.end,
      };
    })
    .filter((span) => span.text) // Filter out spans with empty text
    .sort((a, b) => a.distance - b.distance); // Sort by proximity
}

/**
 * Build simplified span objects for API payload
 * Defensive mapping with validation
 * @param {Array} spans - Raw spans to process
 * @returns {Array} Simplified, validated spans
 */
export function buildSimplifiedSpans(spans) {
  const sanitized = sanitizeSpans(spans);
  
  return sanitized
    .map(normalizeSpan)
    .filter(span => span !== null && span.text && span.text.length > 0);
}

/**
 * Prepare span context for API request
 * @param {Object} metadata - Selected text metadata
 * @param {Array} allLabeledSpans - All labeled spans
 * @returns {Object} Prepared span context { simplifiedSpans, nearbySpans }
 */
export function prepareSpanContext(metadata, allLabeledSpans) {
  // Sanitize input spans
  const sanitizedSpans = sanitizeSpans(allLabeledSpans);
  
  // Build simplified spans
  const simplifiedSpans = buildSimplifiedSpans(sanitizedSpans);
  
  // Find nearby spans
  const nearbySpans = findNearbySpans(metadata, sanitizedSpans, 100)
    .filter(span => span.text && span.text.length > 0);
  
  return {
    simplifiedSpans,
    nearbySpans,
  };
}

