/**
 * Text Matching Utilities
 * 
 * Functions for validating and matching highlighted text against expected values.
 */

import { DEBUG_HIGHLIGHTS } from '../config/constants.js';

/**
 * Normalize text for comparison (lowercase, trim, collapse whitespace)
 */
export function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two normalized strings are substring matches
 */
export function isSubstringMatch(normalizedA, normalizedB) {
  return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

/**
 * Validate that highlighted text matches expected text
 * Uses fuzzy matching to handle whitespace/case differences
 * 
 * @param {string} expectedText - Expected text from span
 * @param {string} actualText - Actual text from DOM
 * @param {Object} span - Span object for logging
 * @param {number} highlightStart - Start offset
 * @param {number} highlightEnd - End offset
 * @returns {boolean} True if text matches (or is empty), false if mismatch
 */
export function validateHighlightText(expectedText, actualText, span, highlightStart, highlightEnd) {
  // Skip empty slices
  if (!actualText || !actualText.trim()) {
    return false;
  }
  
  // If no expected text, allow any actual text
  if (!expectedText) {
    return true;
  }
  
  // Normalize both strings (lowercase, trim, collapse whitespace)
  const normalizedExpected = normalizeText(expectedText);
  const normalizedActual = normalizeText(actualText);
  
  // Exact match after normalization
  if (normalizedExpected === normalizedActual) {
    return true;
  }
  
  // Allow substring matches (e.g., "Close-up" in "Close-up of")
  if (isSubstringMatch(normalizedActual, normalizedExpected)) {
    return true;
  }
  
  // Significant mismatch - log and reject
  if (DEBUG_HIGHLIGHTS) {
    console.warn('[HIGHLIGHT] SPAN_MISMATCH - Skipping highlight', {
      id: span.id,
      role: span.role,
      expected: expectedText,
      found: actualText,
      normalizedExpected,
      normalizedActual,
      start: highlightStart,
      end: highlightEnd,
    });
  }
  
  return false;
}

