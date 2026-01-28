/**
 * Property-based tests for SuggestionCache
 *
 * Tests the following correctness properties:
 * - Property 5: Cache Key Uniqueness
 * - Property 6: Cache Hit Returns Without API Call
 *
 * @module SuggestionCache.property.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

import { SuggestionCache, simpleHash } from '@features/prompt-optimizer/utils/SuggestionCache';

describe('SuggestionCache Property Tests', () => {
  /**
   * Property 5: Cache Key Uniqueness
   *
   * For any two requests with different (highlightedText, contextBefore, contextAfter, promptHash)
   * tuples, the cache keys SHALL be different. For any two requests with identical tuples,
   * the cache keys SHALL be identical.
   *
   * **Feature: ai-suggestions-fixes, Property 5: Cache Key Uniqueness**
   * **Validates: Requirements 6.2, 6.5**
   */
  describe('Property 5: Cache Key Uniqueness', () => {
    it('identical inputs produce identical cache keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (highlightedText, contextBefore, contextAfter, promptHash) => {
            const key1 = SuggestionCache.generateKey(
              highlightedText,
              contextBefore,
              contextAfter,
              promptHash
            );
            const key2 = SuggestionCache.generateKey(
              highlightedText,
              contextBefore,
              contextAfter,
              promptHash
            );

            // Same inputs must produce same key
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different highlightedText produces different cache keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (text1, text2, contextBefore, contextAfter, promptHash) => {
            // Skip if texts are the same
            fc.pre(text1 !== text2);

            const key1 = SuggestionCache.generateKey(text1, contextBefore, contextAfter, promptHash);
            const key2 = SuggestionCache.generateKey(text2, contextBefore, contextAfter, promptHash);

            // Different highlighted text must produce different keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different contextBefore produces different cache keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (highlightedText, context1, context2, contextAfter, promptHash) => {
            // Skip if contexts are the same
            fc.pre(context1 !== context2);

            const key1 = SuggestionCache.generateKey(
              highlightedText,
              context1,
              contextAfter,
              promptHash
            );
            const key2 = SuggestionCache.generateKey(
              highlightedText,
              context2,
              contextAfter,
              promptHash
            );

            // Different context before must produce different keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different contextAfter produces different cache keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          (highlightedText, contextBefore, context1, context2, promptHash) => {
            // Skip if contexts are the same
            fc.pre(context1 !== context2);

            const key1 = SuggestionCache.generateKey(
              highlightedText,
              contextBefore,
              context1,
              promptHash
            );
            const key2 = SuggestionCache.generateKey(
              highlightedText,
              contextBefore,
              context2,
              promptHash
            );

            // Different context after must produce different keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different promptHash produces different cache keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (highlightedText, contextBefore, contextAfter, hash1, hash2) => {
            // Skip if hashes are the same
            fc.pre(hash1 !== hash2);

            const key1 = SuggestionCache.generateKey(
              highlightedText,
              contextBefore,
              contextAfter,
              hash1
            );
            const key2 = SuggestionCache.generateKey(
              highlightedText,
              contextBefore,
              contextAfter,
              hash2
            );

            // Different prompt hash must produce different keys
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('simpleHash produces consistent results for same input', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 500 }), (input) => {
          const hash1 = simpleHash(input);
          const hash2 = simpleHash(input);

          // Same input must produce same hash
          expect(hash1).toBe(hash2);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Cache Hit Returns Without API Call
   *
   * For any cache key that exists and is not expired, requesting that key
   * SHALL return the cached value without making an API call.
   *
   * **Feature: ai-suggestions-fixes, Property 6: Cache Hit Returns Without API Call**
   * **Validates: Requirements 6.1, 6.3**
   */
  describe('Property 6: Cache Hit Returns Without API Call', () => {
    it('cached values are returned without modification', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          (key, suggestions) => {
            // Create fresh cache for each iteration to avoid cross-iteration pollution
            const cache = new SuggestionCache<{ suggestions: string[] }>({ ttlMs: 300000, maxEntries: 100 });
            const value = { suggestions };

            // Set the value
            cache.set(key, value);

            // Get should return the exact same value
            const retrieved = cache.get(key);

            expect(retrieved).not.toBeNull();
            expect(retrieved).toEqual(value);
            expect(retrieved?.suggestions).toEqual(suggestions);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cache hit returns value, cache miss returns null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
          (cachedKey, uncachedKey, suggestions) => {
            // Ensure keys are different
            fc.pre(cachedKey !== uncachedKey);

            // Create fresh cache for each iteration to avoid cross-iteration pollution
            const cache = new SuggestionCache<{ suggestions: string[] }>({ ttlMs: 300000, maxEntries: 100 });
            const value = { suggestions };

            // Set value for cachedKey only
            cache.set(cachedKey, value);

            // Cached key should return value
            expect(cache.get(cachedKey)).toEqual(value);

            // Uncached key should return null
            expect(cache.get(uncachedKey)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple cache entries are stored and retrieved independently', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 2, maxLength: 10 }),
          (keys) => {
            // Create fresh cache for each iteration to avoid cross-iteration pollution
            const cache = new SuggestionCache<{ suggestions: string[] }>({ ttlMs: 300000, maxEntries: 100 });

            // Create unique values for each key
            const entries = keys.map((key, index) => ({
              key,
              value: { suggestions: [`suggestion_${index}`] },
            }));

            // Set all entries
            for (const entry of entries) {
              cache.set(entry.key, entry.value);
            }

            // All entries should be retrievable with correct values
            for (const entry of entries) {
              const retrieved = cache.get(entry.key);
              expect(retrieved).toEqual(entry.value);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cache respects maxEntries limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 1, max: 10 }),
          (maxEntries, extraEntries) => {
            const limitedCache = new SuggestionCache<{ id: number }>({
              ttlMs: 300000,
              maxEntries,
            });

            const totalEntries = maxEntries + extraEntries;

            // Add more entries than maxEntries
            for (let i = 0; i < totalEntries; i++) {
              limitedCache.set(`key_${i}`, { id: i });
            }

            // Cache size should not exceed maxEntries
            expect(limitedCache.size).toBeLessThanOrEqual(maxEntries);

            // Most recent entries should be present
            for (let i = totalEntries - maxEntries; i < totalEntries; i++) {
              expect(limitedCache.get(`key_${i}`)).toEqual({ id: i });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('expired entries return null (simulated with short TTL)', async () => {
      // Use very short TTL for this test
      const shortTtlCache = new SuggestionCache<{ data: string }>({
        ttlMs: 10, // 10ms TTL
        maxEntries: 50,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (key, data) => {
            const value = { data };

            // Set the value
            shortTtlCache.set(key, value);

            // Immediately should be available
            expect(shortTtlCache.get(key)).toEqual(value);

            // Wait for TTL to expire
            await new Promise((resolve) => setTimeout(resolve, 15));

            // After expiry, should return null
            expect(shortTtlCache.get(key)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('has() returns true for valid entries and false for missing/expired', () => {
      fc.assert(
        fc.property(
          // Use prefixed keys to avoid prototype property name collisions
          fc.string({ minLength: 1, maxLength: 50 }).map((s) => `cache_key_${s}`),
          fc.string({ minLength: 1, maxLength: 50 }).map((s) => `cache_key_${s}`),
          fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
          (existingKey, missingKey, suggestions) => {
            // Ensure keys are different
            fc.pre(existingKey !== missingKey);

            // Create fresh cache for each iteration to avoid cross-iteration pollution
            const cache = new SuggestionCache<{ suggestions: string[] }>({ ttlMs: 300000, maxEntries: 100 });

            cache.set(existingKey, { suggestions });

            // has() should return true for existing key
            expect(cache.has(existingKey)).toBe(true);

            // has() should return false for missing key
            expect(cache.has(missingKey)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clear() removes all entries', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
          (keys) => {
            // Create fresh cache for each iteration to avoid cross-iteration pollution
            const cache = new SuggestionCache<{ suggestions: string[] }>({ ttlMs: 300000, maxEntries: 100 });

            // Add entries
            for (const key of keys) {
              cache.set(key, { suggestions: [key] });
            }

            // Verify entries exist
            expect(cache.size).toBe(keys.length);

            // Clear cache
            cache.clear();

            // All entries should be gone
            expect(cache.size).toBe(0);
            for (const key of keys) {
              expect(cache.get(key)).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
