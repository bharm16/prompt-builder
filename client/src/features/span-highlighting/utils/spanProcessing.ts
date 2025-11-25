/**
 * Span Processing Utilities
 * 
 * Business logic for processing labeled spans.
 * Extracted from useEnhancementSuggestions.js.
 * 
 * Architecture: Pure utility functions
 * Pattern: Single responsibility - span processing logic
 */

import { sanitizeSpans, normalizeSpan, type NormalizedSpan } from './spanValidation';

export interface SpanMetadata {
  start?: number;
  end?: number;
  [key: string]: unknown;
}

export interface SpanWithText {
  start: number;
  end: number;
  quote?: string;
  text?: string;
  role?: string;
  category?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface NearbySpan {
  text: string;
  role: string;
  category: string;
  confidence?: number;
  distance: number;
  position: 'before' | 'after';
  start: number;
  end: number;
}

export interface SpanContext {
  simplifiedSpans: NormalizedSpan[];
  nearbySpans: NearbySpan[];
}

/**
 * Find spans that are near the selected text
 */
export function findNearbySpans(
  metadata: SpanMetadata | null | undefined,
  allSpans: SpanWithText[],
  threshold = 100
): NearbySpan[] {
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
      const position: 'before' | 'after' = distanceBefore >= 0 ? 'before' : 'after';

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
 */
export function buildSimplifiedSpans(spans: unknown[]): NormalizedSpan[] {
  const sanitized = sanitizeSpans(spans);
  
  return sanitized
    .map(normalizeSpan)
    .filter((span): span is NormalizedSpan => span !== null && span.text && span.text.length > 0);
}

/**
 * Prepare span context for API request
 */
export function prepareSpanContext(
  metadata: SpanMetadata | null | undefined,
  allLabeledSpans: unknown[]
): SpanContext {
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

