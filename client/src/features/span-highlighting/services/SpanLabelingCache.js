/**
 * Span Labeling Cache Service
 *
 * Manages caching of span labeling results with:
 * - In-memory Map cache for fast lookups
 * - localStorage persistence for cross-session caching
 * - LRU eviction to prevent unbounded growth
 * - Async hydration to avoid blocking initial render
 */

import { PERFORMANCE_CONFIG, STORAGE_KEYS } from '../../../config/performance.config';
import { hashString } from '../utils/hashing.js';
import { buildCacheKey as buildCacheKeyUtil } from '../utils/cacheKey.js';
import { getCacheStorage } from './storageAdapter.js';

// Cache version - increment when highlight format changes
// v3: Added mergeFragmentedSpans to combine adjacent spans of same category
const CURRENT_CACHE_VERSION = 3;

/**
 * Cache service for span labeling results
 * Singleton pattern - shared across all hook instances for better cache hit rate
 */
class SpanLabelingCache {
  constructor() {
    this.cache = new Map();
    this.hydrated = false;
    this.storageKey = STORAGE_KEYS.SPAN_LABELING_CACHE;
    this.limit = PERFORMANCE_CONFIG.SPAN_LABELING_CACHE_LIMIT;
  }

  /**
   * Builds a cache key from the span labeling payload
   * @private
   */
  buildCacheKey(payload) {
    return buildCacheKeyUtil(payload, hashString);
  }

  /**
   * Hydrate cache from localStorage asynchronously using requestIdleCallback
   * This prevents blocking the main thread during component mount
   */
  hydrate() {
    if (this.hydrated) {
      return;
    }
    this.hydrated = true;

    const storage = getCacheStorage();
    if (!storage) {
      return;
    }

    // Defer cache hydration to avoid blocking initial render
    const performHydration = () => {
      try {
        const raw = storage.getItem(this.storageKey);
        if (!raw) {
          return;
        }
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) {
          return;
        }

        entries.forEach(([key, value]) => {
          if (!key || typeof key !== 'string' || !value || typeof value !== 'object') {
            return;
          }

          // CACHE VERSION CHECK: Skip outdated entries during hydration
          const cacheVersion = value.meta?.cacheVersion || 1;
          if (cacheVersion < CURRENT_CACHE_VERSION) {
            // Silently skip - will be logged when user tries to access
            return;
          }

          const normalized = {
            spans: Array.isArray(value.spans) ? value.spans : [],
            meta: value.meta ?? null,
            timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
            text: typeof value.text === 'string' ? value.text : '',
            cacheId: typeof value.cacheId === 'string' ? value.cacheId : null,
            signature: typeof value.signature === 'string' ? value.signature : null,
          };
          if (!normalized.text) {
            return;
          }
          if (!normalized.signature) {
            normalized.signature = hashString(normalized.text ?? '');
          }
          this.cache.set(key, normalized);
        });

        // Apply LRU eviction if cache is over limit
        while (this.cache.size > this.limit) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
      } catch (error) {
        console.warn('Unable to hydrate span labeling cache:', error);
        this.cache.clear();
      }
    };

    // Use requestIdleCallback for non-blocking hydration
    // Falls back to setTimeout for browsers without requestIdleCallback
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(performHydration, { timeout: 2000 });
    } else {
      setTimeout(performHydration, 100);
    }
  }

  /**
   * Persist cache to localStorage
   * @private
   */
  persist() {
    const storage = getCacheStorage();
    if (!storage) {
      return;
    }

    try {
      const serialized = Array.from(this.cache.entries()).map(([key, value]) => [
        key,
        {
          spans: Array.isArray(value.spans) ? value.spans : [],
          meta: value.meta ?? null,
          timestamp: typeof value.timestamp === 'number' ? value.timestamp : Date.now(),
          text: typeof value.text === 'string' ? value.text : '',
          cacheId: typeof value.cacheId === 'string' ? value.cacheId : null,
          signature: typeof value.signature === 'string' ? value.signature : hashString(value.text ?? ''),
        },
      ]);
      storage.setItem(this.storageKey, JSON.stringify(serialized));
    } catch (error) {
      console.warn('Unable to persist span labeling cache:', error);
    }
  }

  /**
   * Get cached result for a payload
   * @param {Object} payload - Span labeling request payload
   * @returns {Object|null} Cached result or null if not found/invalid
   */
  get(payload) {
    this.hydrate();
    const key = this.buildCacheKey(payload);
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    // Validate text matches to prevent stale cache hits
    if (cached.text !== payload.text) {
      return null;
    }

    // CACHE VERSION CHECK: Invalidate old format highlights
    const cacheVersion = cached.meta?.cacheVersion || 1;
    if (cacheVersion < CURRENT_CACHE_VERSION) {
      console.log('[CACHE] Invalidating outdated cache entry (v' + cacheVersion + ' < v' + CURRENT_CACHE_VERSION + ')');
      this.cache.delete(key);
      return null;
    }

    const signature = typeof cached.signature === 'string' ? cached.signature : hashString(cached.text ?? '');
    return {
      ...cached,
      signature,
    };
  }

  /**
   * Set cached result for a payload
   * @param {Object} payload - Span labeling request payload
   * @param {Object} data - Result data to cache
   */
  set(payload, data) {
    this.hydrate();
    if (!payload?.text) {
      return;
    }
    const key = this.buildCacheKey(payload);
    const entry = {
      spans: Array.isArray(data?.spans) ? data.spans : [],
      meta: {
        ...(data?.meta ?? {}),
        cacheVersion: CURRENT_CACHE_VERSION, // Add version stamp
      },
      timestamp: Date.now(),
      text: payload.text ?? '',
      cacheId: payload.cacheId ?? null,
      signature: data?.signature ?? hashString(payload.text ?? ''),
    };

    // Update recency for simple LRU semantics (delete then re-add moves to end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, entry);

    // Apply LRU eviction if over limit
    while (this.cache.size > this.limit) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.persist();
  }

  /**
   * Clear all cache entries (for testing)
   */
  clear() {
    this.cache.clear();
    this.hydrated = false;
    const storage = getCacheStorage();
    if (!storage) {
      return;
    }
    try {
      storage.removeItem(this.storageKey);
    } catch (error) {
      // Ignore storage access errors
    }
  }

  /**
   * Get snapshot of cache for debugging
   * @returns {Array} Array of cache entry summaries
   */
  getSnapshot() {
    return Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      cacheId: value?.cacheId ?? null,
      spanCount: Array.isArray(value?.spans) ? value.spans.length : 0,
      textPreview: typeof value?.text === 'string' ? value.text.slice(0, 40) : '',
    }));
  }
}

/**
 * Singleton instance - shared across all hook instances
 * This provides better cache hit rate and memory efficiency
 */
export const spanLabelingCache = new SpanLabelingCache();
