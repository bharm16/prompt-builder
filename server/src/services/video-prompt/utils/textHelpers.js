/**
 * Pure text utility functions
 */

/**
 * Count words in a string
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Check if text appears to be a sentence
 * @param {string} text - Text to check
 * @param {number} wordCount - Word count (optional, will calculate if not provided)
 * @returns {boolean} True if text is likely a sentence
 */
export function isSentence(text, wordCount = null) {
  if (!text) return false;
  
  const trimmed = text.trim();
  const count = wordCount ?? countWords(trimmed);
  
  return /[.!?]$/.test(trimmed) || count >= 12;
}

/**
 * Normalize text to lowercase
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  return (text || '').toLowerCase();
}

