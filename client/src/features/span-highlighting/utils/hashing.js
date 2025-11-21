/**
 * Hashing utilities with memoization for span labeling
 */

import { PERFORMANCE_CONFIG } from '../../../config/performance.config';

// Hash cache for memoization (LRU eviction)
const hashCache = new Map();
const HASH_CACHE_MAX_SIZE = PERFORMANCE_CONFIG.HASH_CACHE_MAX_SIZE;

/**
 * Optimized string hashing with memoization
 * Uses FNV-1a hash algorithm (faster than original implementation)
 * Caches results to avoid re-computing hashes for the same strings
 *
 * @param {string} input - String to hash
 * @returns {string} Hash string in base-36 format
 */
export const hashString = (input = '') => {
  if (!input) return '0';

  // Check cache first
  if (hashCache.has(input)) {
    return hashCache.get(input);
  }

  // FNV-1a hash (faster than previous implementation)
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime: 16777619
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const result = (hash >>> 0).toString(36);

  // Cache with LRU eviction
  if (hashCache.size >= HASH_CACHE_MAX_SIZE) {
    const firstKey = hashCache.keys().next().value;
    hashCache.delete(firstKey);
  }
  hashCache.set(input, result);

  return result;
};

/**
 * Clears the hash cache (primarily for testing)
 * @private
 */
export const __clearHashCache = () => {
  hashCache.clear();
};

/**
 * Gets the current size of the hash cache (primarily for testing)
 * @private
 */
export const __getHashCacheSize = () => {
  return hashCache.size;
};
