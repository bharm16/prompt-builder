import crypto from 'crypto';
import NodeCache from 'node-cache';
import type { InputSpan, LabeledSpan } from './types.js';

const cache = new NodeCache({ stdTTL: 120 });

// Cache version for taxonomy migration - bump to invalidate old cached responses
const CACHE_VERSION = 'v3-taxonomy';

export function hashKey(spans: InputSpan[], ver: string): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(spans) + '|' + ver + '|' + CACHE_VERSION)
    .digest('hex');
}

export function getCachedLabels(key: string): LabeledSpan[] | undefined {
  return cache.get<LabeledSpan[]>(key);
}

export function setCachedLabels(key: string, labeled: LabeledSpan[]): void {
  cache.set(key, labeled);
}
