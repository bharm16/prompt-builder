/**
 * Text utilities for span labeling
 */

/**
 * Normalizes text using Unicode NFC normalization
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeText = (text) => (typeof text === 'string' ? text.normalize('NFC') : '');

/**
 * Serializes a policy object into a deterministic string for cache keys
 * @param {Object} policy - Policy object to serialize
 * @returns {string} Serialized policy string
 */
export const serializePolicy = (policy) => {
  if (!policy || typeof policy !== 'object') {
    return '';
  }

  return Object.keys(policy)
    .sort()
    .map((key) => {
      const value = policy[key];
      if (value && typeof value === 'object') {
        return `${key}:${JSON.stringify(value)}`;
      }
      return `${key}:${String(value)}`;
    })
    .join('|');
};
