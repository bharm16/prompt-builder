/**
 * SuggestionCache - TTL-based in-memory cache for suggestion results.
 * Provides fast lookups for previously fetched suggestions.
 *
 * @module SuggestionCache
 */

/**
 * Cache entry with data and timestamp.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Configuration for the cache.
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds. Default: 300000 (5 minutes) */
  ttlMs: number;
  /** Maximum number of entries. Default: 50 */
  maxEntries: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 300000, // 5 minutes
  maxEntries: 50,
};

/**
 * Simple fast hash function for strings.
 * Uses 32-bit FNV-1a for better distribution in cache keys.
 *
 * @param str - String to hash
 * @returns A short hash string
 */
export function simpleHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${str.length.toString(36)}_${(hash >>> 0).toString(16)}`;
}

/**
 * TTL-based in-memory cache for suggestion results.
 *
 * @example
 * ```typescript
 * const cache = new SuggestionCache<SuggestionsResponse>({ ttlMs: 300000 });
 *
 * const key = SuggestionCache.generateKey(
 *   highlightedText,
 *   contextBefore,
 *   contextAfter,
 *   simpleHash(fullPrompt)
 * );
 *
 * // Check cache
 * const cached = cache.get(key);
 * if (cached) {
 *   return cached;
 * }
 *
 * // Fetch and cache
 * const result = await fetchSuggestions();
 * cache.set(key, result);
 * ```
 */
export class SuggestionCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * Generate cache key from components.
   * Key includes: text + context window + prompt hash
   *
   * @param highlightedText - The selected text
   * @param contextBefore - Last 100 chars before selection
   * @param contextAfter - First 100 chars after selection
   * @param promptHash - Simple hash of full prompt
   * @returns Cache key string
   */
  static generateKey(highlightedText: string, contextBefore: string, contextAfter: string, promptHash: string): string {
    return `${highlightedText}|${contextBefore}|${contextAfter}|${promptHash}`;
  }

  /**
   * Get a value from the cache.
   * Returns null if not found or expired.
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlMs) {
      // Remove expired entry
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value in the cache.
   * Enforces maxEntries limit by removing oldest entries.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    // Enforce max entries limit
    if (this.cache.size >= this.config.maxEntries) {
      // Remove oldest entry (first in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries from the cache.
   * Call periodically to free memory.
   */
  prune(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get the current size of the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists and is not expired.
   *
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
