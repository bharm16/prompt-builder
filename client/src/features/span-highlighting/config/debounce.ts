/**
 * Smart debounce configuration and calculation
 */

/**
 * Calculate smart debounce delay based on text length
 *
 * Performance optimization: Shorter texts get faster processing
 * to improve perceived responsiveness, while longer texts use
 * longer delays to reduce unnecessary API calls.
 *
 * Optimized Thresholds (LLM-only system - 2x faster):
 * - <100 chars: 50ms (instant for very short snippets)
 * - 100-500 chars: 150ms (fast for short text)
 * - 500-2000 chars: 300ms (balanced for medium text)
 * - >2000 chars: 450ms (still responsive for large text)
 */
export const calculateSmartDebounce = (text: string | null | undefined): number => {
  if (!text) return 50; // Default for empty text

  const length = text.length;

  if (length < 100) {
    return 50; // Very short: instant
  } else if (length < 500) {
    return 150; // Short text: fast response
  } else if (length < 2000) {
    return 300; // Medium text: balanced
  } else {
    return 450; // Large text: still responsive
  }
};

