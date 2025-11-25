/**
 * Cache key building utilities for span labeling
 */

import { serializePolicy } from './textUtils';

export interface CacheKeyPayload {
  text?: string;
  cacheId?: string;
  maxSpans?: number;
  minConfidence?: number;
  templateVersion?: string;
  policy?: Record<string, unknown>;
}

/**
 * Builds a unique cache key from the span labeling payload
 *
 * The cache key includes:
 * - maxSpans: Maximum number of spans to return
 * - minConfidence: Minimum confidence threshold
 * - templateVersion: Version of the labeling template
 * - policyKey: Serialized policy configuration
 * - derivedId: Text hash with optional cache ID prefix
 */
export const buildCacheKey = (
  payload: CacheKeyPayload = {},
  hashString: (text: string) => string
): string => {
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

