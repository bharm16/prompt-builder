/**
 * Text utilities for span labeling
 */

/**
 * Normalizes text using Unicode NFC normalization
 */
export const sanitizeText = (text: unknown): string => {
  return typeof text === 'string' ? text.normalize('NFC') : '';
};

/**
 * Serializes a policy object into a deterministic string for cache keys
 */
export const serializePolicy = (policy: unknown): string => {
  if (!policy || typeof policy !== 'object') {
    return '';
  }

  const policyObj = policy as Record<string, unknown>;

  return Object.keys(policyObj)
    .sort()
    .map((key) => {
      const value = policyObj[key];
      if (value && typeof value === 'object') {
        return `${key}:${JSON.stringify(value)}`;
      }
      return `${key}:${String(value)}`;
    })
    .join('|');
};

