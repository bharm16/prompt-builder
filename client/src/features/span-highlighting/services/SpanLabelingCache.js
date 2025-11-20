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
import { getVersionString } from '#shared/version.js';

// Cache version - includes system versions from shared/version.js
// This ensures cache invalidation when taxonomy, prompts, or API changes
const CURRENT_CACHE_VERSION = getVersionString();

// Cache entry max age (24 hours)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Cache service for span labeling results
 * Singleton pattern - shared across all hook instances for better cache hit rate
 */
class SpanLabelingCache {
  constructor() {
    this.cache = new Map();
    this.hydrated = false;
    this.storageKey = STORAGE_KEYS.SPAN_LABELING_CACHE;
    this.versionKey = 'span_cache_version';
    this.limit = PERFORMANCE_CONFIG.SPAN_LABELING_CACHE_LIMIT;
    this.version = CURRENT_CACHE_VERSION;
    
    // Validate version on initialization
    this.validateVersion();
  }
  
  /**
   * Validate cache version and clear if mismatched
   */
  validateVersion() {
    const storage = getCacheStorage();
    if (!storage) return;
    
    try {
      const storedVersion = storage.getItem(this.versionKey);
      if (storedVersion !== this.version) {
        console.log(`[SpanLabelingCache] Version changed from ${storedVersion} to ${this.version}, clearing cache`);
        this.clear();
        storage.setItem(this.versionKey, this.version);
      }
    } catch (error) {
      console.warn('[SpanLabelingCache] Failed to validate version:', error);
    }
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
          const entryVersion = value.version || value.meta?.cacheVersion || '';
          if (entryVersion !== CURRENT_CACHE_VERSION) {
            // Skip outdated entries - different version
            return;
          }
          
          // CACHE AGE CHECK: Skip expired entries (older than 24 hours)
          const timestamp = value.timestamp || 0;
          const age = Date.now() - timestamp;
          if (age > MAX_CACHE_AGE_MS) {
            // Skip expired entries
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
          version: value.version || CURRENT_CACHE_VERSION,
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

    // CACHE VERSION CHECK: Invalidate entries with different version
    const entryVersion = cached.version || cached.meta?.cacheVersion || '';
    if (entryVersion !== CURRENT_CACHE_VERSION) {
      console.log('[SpanLabelingCache] Invalidating outdated cache entry (version mismatch)');
      this.cache.delete(key);
      return null;
    }
    
    // CACHE AGE CHECK: Invalidate expired entries
    const timestamp = cached.timestamp || 0;
    const age = Date.now() - timestamp;
    if (age > MAX_CACHE_AGE_MS) {
      console.log(`[SpanLabelingCache] Invalidating expired cache entry (age: ${Math.round(age / 3600000)}h)`);
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
        cacheVersion: CURRENT_CACHE_VERSION, // Legacy field for backwards compatibility
      },
      version: CURRENT_CACHE_VERSION, // Primary version field
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
