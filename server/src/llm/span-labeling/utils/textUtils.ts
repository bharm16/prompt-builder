import { DEFAULT_CONFIDENCE } from '../config/SpanLabelingConfig.js';

interface SpanLike {
  start: number;
  end: number;
  text: string;
}

/**
 * Text utility functions for span labeling
 *
 * Pure functions for text processing, word counting, and value clamping.
 * These are extracted for easy testing and reuse.
 */

/**
 * Clamp a value to the range [0, 1]
 * @param {number} value - Value to clamp
 * @returns {number} Clamped value between 0 and 1, or DEFAULT_CONFIDENCE if invalid
 */
export function clamp01(value: unknown): number {
  return typeof value === 'number'
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_CONFIDENCE;
}

/**
 * Count words in text using Unicode-aware regex
 *
 * Uses \p{L} for Unicode letters and \p{N} for Unicode numbers,
 * supporting international characters properly.
 *
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  // Matches word boundaries with Unicode letter/number support
  // Includes hyphens and apostrophes within words
  return (text.match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;
}

/**
 * Check if span text matches at the specified indices in source text
 * @param {string} text - Source text
 * @param {Object} span - Span with start, end, and text properties
 * @returns {boolean} True if text matches at indices
 */
export function matchesAtIndices(text: string, span: SpanLike): boolean {
  return text.slice(span.start, span.end) === span.text;
}

/**
 * Build unique key for span deduplication
 * @param {Object} span - Span object with start, end, and text
 * @returns {string} Unique key string
 */
export function buildSpanKey(span: SpanLike): string {
  return `${span.start}|${span.end}|${span.text}`;
}

/**
 * Format validation errors into numbered list
 * @param {Array<string>} errors - Error messages
 * @returns {string} Formatted error list
 */
export function formatValidationErrors(errors: string[]): string {
  return errors.map((err, index) => `${index + 1}. ${err}`).join('\n');
}
