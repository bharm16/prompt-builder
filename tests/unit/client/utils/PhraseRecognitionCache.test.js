import { describe, it, expect, beforeEach } from 'vitest';
import { PhraseRecognitionCache } from '../PhraseRecognitionCache.js';

describe('PhraseRecognitionCache', () => {
  let cache;

  beforeEach(() => {
    cache = new PhraseRecognitionCache();
    cache.clearAll();
    cache.resetMetrics();
  });

  it('caches compiled regex patterns and reuses them', () => {
    const p1 = cache.getCompiledPattern('test', 'gi');
    const p2 = cache.getCompiledPattern('test', 'gi');
    const p3 = cache.getCompiledPattern('test', 'g');

    expect(p1).toBeInstanceOf(RegExp);
    expect(p1).toBe(p2);
    expect(p1).not.toBe(p3);
    expect(cache.getMetrics().patternsCached).toBeGreaterThanOrEqual(2);
  });

  it('generates stable cache keys by text and categories', () => {
    const categoriesA = { a: ['x'], b: ['y'] };
    const categoriesB = { b: ['y'], a: ['x'] }; // order-insensitive
    const text = 'Some text here';

    const k1 = cache.generateCacheKey(text, categoriesA);
    const k2 = cache.generateCacheKey(text, categoriesB);
    expect(k1).toBe(k2);
  });

  it('stores and retrieves cached results with hit/miss metrics', () => {
    const text = 'Example text';
    const cats = { a: [], b: [] };
    const result = [{ start: 0, end: 7 }];

    // Miss first
    expect(cache.getCachedResult(text, cats)).toBeNull();
    const afterMiss = cache.getMetrics();
    expect(afterMiss.cacheMisses).toBe(1);

    // Set and then hit
    cache.cacheResult(text, cats, result);
    expect(cache.getCachedResult(text, cats)).toEqual(result);
    const afterHit = cache.getMetrics();
    expect(afterHit.cacheHits).toBe(1);
    expect(afterHit.hitRate).toBeDefined();
  });

  it('LRU cache evicts oldest when over capacity', () => {
    // Reduce size for test by poking internal LRU
    cache.resultsCache.maxSize = 3;

    const cats = { a: [] };
    cache.cacheResult('t1', cats, 1);
    cache.cacheResult('t2', cats, 2);
    cache.cacheResult('t3', cats, 3);
    // Access t1 to mark it MRU
    cache.getCachedResult('t1', cats);
    // Insert new, evict LRU (t2)
    cache.cacheResult('t4', cats, 4);

    expect(cache.getCachedResult('t2', cats)).toBeNull();
    expect(cache.getCachedResult('t1', cats)).toBe(1);
  });
});
