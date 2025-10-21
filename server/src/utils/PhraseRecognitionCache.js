/**
 * Performance optimization layer for phrase recognition
 *
 * Features:
 * - Regex pattern caching to avoid recompilation
 * - Result memoization with LRU cache
 * - Smart cache invalidation
 */

class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Delete if exists to re-insert at end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

class PhraseRecognitionCache {
  constructor() {
    // Cache compiled regex patterns (never expires)
    this.patternCache = new Map();

    // Cache highlight results (LRU with max 100 entries)
    this.resultsCache = new LRUCache(100);

    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      patternCompilations: 0,
    };
  }

  /**
   * Get or compile a regex pattern
   */
  getCompiledPattern(patternSource, flags) {
    const cacheKey = `${patternSource}::${flags}`;

    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey);
    }

    // Compile and cache
    const compiled = new RegExp(patternSource, flags);
    this.patternCache.set(cacheKey, compiled);
    this.metrics.patternCompilations++;

    return compiled;
  }

  /**
   * Generate cache key for text highlighting
   */
  generateCacheKey(text, categories) {
    // Create a hash-like key from text and category names
    const categoryKeys = Object.keys(categories).sort().join(',');
    const textHash = this.simpleHash(text);
    return `${textHash}::${categoryKeys}`;
  }

  /**
   * Simple hash function for cache keys
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached highlighting result
   */
  getCachedResult(text, categories) {
    const key = this.generateCacheKey(text, categories);
    const cached = this.resultsCache.get(key);

    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Cache highlighting result
   */
  cacheResult(text, categories, result) {
    const key = this.generateCacheKey(text, categories);
    this.resultsCache.set(key, result);
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.resultsCache.clear();
    // Keep pattern cache - those are static
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(2) + '%' : '0%',
      cacheSize: this.resultsCache.cache.size,
      patternsCached: this.patternCache.size,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      patternCompilations: 0,
    };
  }
}

// Export singleton instance
export const phraseCache = new PhraseRecognitionCache();

// Export class for testing
export { PhraseRecognitionCache };
