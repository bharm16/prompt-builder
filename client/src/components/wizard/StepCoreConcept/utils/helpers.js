/**
 * Utility Functions
 *
 * Validation, formatting, and helper utilities for StepCoreConcept.
 *
 * @module helpers
 */

/**
 * Convert number to px string
 * @param {number|string} n - Number or string to convert
 * @returns {string} Pixel string (e.g., "16px") or original string
 * @example
 * px(16) // "16px"
 * px("16px") // "16px"
 */
export const px = (n) => (typeof n === "number" ? `${n}px` : n);

/**
 * Validation helpers
 */
export const validators = {
  /**
   * Check if value meets minimum length requirement
   * @param {string} value - Value to validate
   * @param {number} min - Minimum length (default: 3)
   * @returns {boolean} True if valid, false otherwise
   * @example
   * validators.minLength("hello", 3) // true
   * validators.minLength("hi", 3) // false
   */
  minLength: (value, min = 3) => {
    const trimmed = value?.trim() || "";
    return trimmed.length >= min;
  },
};
