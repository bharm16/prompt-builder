/**
 * Cache key building utilities for span labeling
 */

import { serializePolicy } from './textUtils.js';

/**
 * Builds a unique cache key from the span labeling payload
 *
 * The cache key includes:
 * - maxSpans: Maximum number of spans to return
 * - minConfidence: Minimum confidence threshold
 * - templateVersion: Version of the labeling template
 * - policyKey: Serialized policy configuration
 * - derivedId: Text hash with optional cache ID prefix
 *
 * @param {Object} payload - The span labeling request payload
 * @param {string} payload.text - Text to label
 * @param {string} [payload.cacheId] - Optional cache ID prefix
 * @param {number} [payload.maxSpans] - Maximum spans
 * @param {number} [payload.minConfidence] - Minimum confidence
 * @param {string} [payload.templateVersion] - Template version
 * @param {Object} [payload.policy] - Policy configuration
 * @param {Function} hashString - Hash function to use for text
 * @returns {string} Cache key
 */
export const buildCacheKey = (payload = {}, hashString) => {
  const text = payload.text ?? '';
  const baseId =
    typeof payload.cacheId === 'string' && payload.cacheId.trim().length > 0
      ? payload.cacheId.trim()
      : null;
  const derivedId = baseId ? `${baseId}::${hashString(text)}` : `anon::${hashString(text)}`;
  const policyKey = serializePolicy(payload.policy);
  return [
    payload.maxSpans ?? '',
    payload.minConfidence ?? '',
    payload.templateVersion ?? '',
    policyKey,
    derivedId,
  ].join('::');
};
