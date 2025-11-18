/**
 * @test {CacheService}
 * @description Comprehensive test suite for CacheService
 * 
 * Test Coverage:
 * - Constructor initialization and configuration
 * - Cache operations (get, set, delete, flush)
 * - Cache key generation (semantic and standard)
 * - Statistics tracking and hit rate calculation
 * - Health checks
 * - Edge cases and error handling
 * 
 * Mocking Strategy:
 * - Logger, MetricsService, and SemanticCacheEnhancer are module-level mocks
 *   because CacheService doesn't currently support constructor injection
 * - NOTE: Ideally, CacheService would accept these as constructor parameters
 *   for true dependency injection (see EXAMPLE_BACKEND_TEST.test.js)
 * - The actual cache logic (NodeCache) is NOT mocked - we test real behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Module-level mocks (required due to direct imports in CacheService)
// TODO: Refactor CacheService to accept dependencies via constructor
vi.mock('../../../../server/src/infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../server/src/infrastructure/MetricsService.js', () => ({
  metricsService: {
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    updateCacheHitRate: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/cache/SemanticCacheService.js', () => ({
  SemanticCacheEnhancer: {
    generateSemanticKey: vi.fn((namespace, data) => {
      // Simple mock implementation that creates predictable keys
      const dataStr = JSON.stringify(data);
      return `${namespace}:semantic:${dataStr.length}`;
    }),
  },
}));

import { CacheService } from '../../../../server/src/services/cache/CacheService.js';
import { logger } from '../../../../server/src/infrastructure/Logger.js';
import { metricsService } from '../../../../server/src/infrastructure/MetricsService.js';
import { SemanticCacheEnhancer } from '../../../../server/src/services/cache/SemanticCacheService.js';

describe('CacheService', () => {
  let cacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = new CacheService();
  });

  afterEach(() => {
    // Clean up cache between tests
    cacheService.flush();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(cacheService.cache).toBeDefined();
      expect(cacheService.stats).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
      });
    });

    it('should use default TTL if not provided', () => {
      const service = new CacheService();

      expect(service.cache.options.stdTTL).toBe(3600);
    });

    it('should accept custom TTL configuration', () => {
      const service = new CacheService({ defaultTTL: 7200 });

      expect(service.cache.options.stdTTL).toBe(7200);
    });

    it('should initialize with predefined cache type configurations', () => {
      expect(cacheService.config.promptOptimization).toEqual({
        ttl: 3600,
        namespace: 'prompt',
      });
      expect(cacheService.config.questionGeneration).toEqual({
        ttl: 1800,
        namespace: 'questions',
      });
      expect(cacheService.config.enhancement).toEqual({
        ttl: 3600,
        namespace: 'enhancement',
      });
    });

    it('should allow overriding predefined configurations', () => {
      const service = new CacheService({
        promptOptimization: { ttl: 5000, namespace: 'custom-prompt' },
      });

      expect(service.config.promptOptimization).toEqual({
        ttl: 5000,
        namespace: 'custom-prompt',
      });
    });
  });

  describe('generateKey', () => {
    it('should generate semantic key by default', () => {
      const key = cacheService.generateKey('test', { prompt: 'hello' });

      expect(SemanticCacheEnhancer.generateSemanticKey).toHaveBeenCalledWith(
        'test',
        { prompt: 'hello' },
        {
          normalizeWhitespace: true,
          ignoreCase: true,
          sortKeys: true,
        }
      );
      expect(key).toContain('test:semantic:');
    });

    it('should use standard hashing when semantic caching is disabled', () => {
      const key = cacheService.generateKey(
        'namespace',
        { data: 'test' },
        { useSemantic: false }
      );

      expect(key).toMatch(/^namespace:[a-f0-9]{16}$/);
      expect(SemanticCacheEnhancer.generateSemanticKey).not.toHaveBeenCalled();
    });

    it('should generate consistent keys for same data (non-semantic)', () => {
      const key1 = cacheService.generateKey(
        'test',
        { a: 1, b: 2 },
        { useSemantic: false }
      );
      const key2 = cacheService.generateKey(
        'test',
        { a: 1, b: 2 },
        { useSemantic: false }
      );

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different data (non-semantic)', () => {
      const key1 = cacheService.generateKey(
        'test',
        { a: 1 },
        { useSemantic: false }
      );
      const key2 = cacheService.generateKey(
        'test',
        { a: 2 },
        { useSemantic: false }
      );

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different namespaces', () => {
      const key1 = cacheService.generateKey(
        'ns1',
        { data: 'test' },
        { useSemantic: false }
      );
      const key2 = cacheService.generateKey(
        'ns2',
        { data: 'test' },
        { useSemantic: false }
      );

      expect(key1).not.toBe(key2);
      expect(key1).toContain('ns1:');
      expect(key2).toContain('ns2:');
    });

    it('should pass semantic options correctly', () => {
      cacheService.generateKey('test', { data: 'test' }, {
        useSemantic: true,
        normalizeWhitespace: false,
        ignoreCase: false,
        sortKeys: false,
      });

      expect(SemanticCacheEnhancer.generateSemanticKey).toHaveBeenCalledWith(
        'test',
        { data: 'test' },
        {
          normalizeWhitespace: false,
          ignoreCase: false,
          sortKeys: false,
        }
      );
    });
  });

  describe('get', () => {
    it('should return value from cache when key exists', async () => {
      const key = 'test-key';
      const value = { data: 'cached data' };
      await cacheService.set(key, value);

      const result = await cacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should return null when key does not exist', async () => {
      const result = await cacheService.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should increment hits counter on cache hit', async () => {
      const key = 'test-key';
      await cacheService.set(key, 'value');

      expect(cacheService.stats.hits).toBe(0);

      await cacheService.get(key);

      expect(cacheService.stats.hits).toBe(1);
    });

    it('should increment misses counter on cache miss', async () => {
      expect(cacheService.stats.misses).toBe(0);

      await cacheService.get('nonexistent');

      expect(cacheService.stats.misses).toBe(1);
    });

    it('should record metrics for cache hit', async () => {
      const key = 'test-key';
      await cacheService.set(key, 'value');

      await cacheService.get(key, 'test-type');

      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('test-type');
      expect(metricsService.updateCacheHitRate).toHaveBeenCalled();
    });

    it('should record metrics for cache miss', async () => {
      await cacheService.get('nonexistent', 'test-type');

      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('test-type');
      expect(metricsService.updateCacheHitRate).toHaveBeenCalled();
    });

    it('should use default cache type if not specified', async () => {
      await cacheService.get('key');

      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('default');
    });

    it('should handle null values correctly', async () => {
      const key = 'null-key';
      await cacheService.set(key, null);

      const result = await cacheService.get(key);

      // NodeCache returns undefined for null values, which our get method converts to null
      expect(result).toBeNull();
    });

    it('should handle boolean values', async () => {
      const key = 'bool-key';
      await cacheService.set(key, false);

      const result = await cacheService.get(key);

      expect(result).toBe(false);
    });

    it('should handle number values', async () => {
      const key = 'number-key';
      await cacheService.set(key, 42);

      const result = await cacheService.get(key);

      expect(result).toBe(42);
    });

    it('should handle string values', async () => {
      const key = 'string-key';
      await cacheService.set(key, 'hello world');

      const result = await cacheService.get(key);

      expect(result).toBe('hello world');
    });

    it('should handle complex objects', async () => {
      const key = 'object-key';
      const value = {
        nested: { data: 'value' },
        array: [1, 2, 3],
        boolean: true,
      };
      await cacheService.set(key, value);

      const result = await cacheService.get(key);

      expect(result).toEqual(value);
    });
  });

  describe('set', () => {
    it('should store value in cache', async () => {
      const key = 'test-key';
      const value = { data: 'test' };

      await cacheService.set(key, value);

      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should return true on successful set', async () => {
      const result = await cacheService.set('key', 'value');

      expect(result).toBe(true);
    });

    it('should increment sets counter', async () => {
      expect(cacheService.stats.sets).toBe(0);

      await cacheService.set('key', 'value');

      expect(cacheService.stats.sets).toBe(1);
    });

    it('should use default TTL if not specified', async () => {
      const key = 'ttl-test';
      await cacheService.set(key, 'value');

      // Value should still exist (default TTL is 3600s)
      const result = await cacheService.get(key);
      expect(result).toBe('value');
    });

    it('should accept custom TTL', async () => {
      const key = 'custom-ttl';
      await cacheService.set(key, 'value', { ttl: 1 }); // 1 second

      // Immediately should exist
      const immediate = await cacheService.get(key);
      expect(immediate).toBe('value');

      // After 1.5 seconds should be expired
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const afterExpiry = await cacheService.get(key);
      expect(afterExpiry).toBeNull();
    });

    it('should overwrite existing key', async () => {
      const key = 'overwrite-test';
      await cacheService.set(key, 'old value');
      await cacheService.set(key, 'new value');

      const result = await cacheService.get(key);
      expect(result).toBe('new value');
    });

    it('should handle rapid successive sets', async () => {
      const key = 'rapid-set';
      await cacheService.set(key, 1);
      await cacheService.set(key, 2);
      await cacheService.set(key, 3);

      const result = await cacheService.get(key);
      expect(result).toBe(3);
      expect(cacheService.stats.sets).toBe(3);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      const key = 'delete-test';
      await cacheService.set(key, 'value');

      const deleted = await cacheService.delete(key);

      expect(deleted).toBe(1);
      const result = await cacheService.get(key);
      expect(result).toBeNull();
    });

    it('should return 0 for non-existent key', async () => {
      const deleted = await cacheService.delete('nonexistent');

      expect(deleted).toBe(0);
    });

    it('should handle deleting already deleted key', async () => {
      const key = 'double-delete';
      await cacheService.set(key, 'value');
      await cacheService.delete(key);

      const secondDelete = await cacheService.delete(key);

      expect(secondDelete).toBe(0);
    });
  });

  describe('flush', () => {
    it('should clear all cache entries', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.set('key3', 'value3');

      await cacheService.flush();

      const result1 = await cacheService.get('key1');
      const result2 = await cacheService.get('key2');
      const result3 = await cacheService.get('key3');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should not reset stats counters', async () => {
      await cacheService.set('key', 'value');
      await cacheService.get('key'); // hit
      await cacheService.get('missing'); // miss

      expect(cacheService.stats.hits).toBe(1);
      expect(cacheService.stats.misses).toBe(1);

      await cacheService.flush();

      expect(cacheService.stats.hits).toBe(1);
      expect(cacheService.stats.misses).toBe(1);
    });

    it('should allow new entries after flush', async () => {
      await cacheService.set('old', 'value');
      await cacheService.flush();
      await cacheService.set('new', 'value');

      const result = await cacheService.get('new');
      expect(result).toBe('value');
    });
  });

  describe('getCacheStats', () => {
    it('should return correct stats with no activity', () => {
      const stats = cacheService.getCacheStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        hitRate: '0.00%',
        keys: 0,
        size: expect.any(Object),
      });
    });

    it('should calculate hit rate correctly', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');

      await cacheService.get('key1'); // hit
      await cacheService.get('key2'); // hit
      await cacheService.get('key3'); // miss
      await cacheService.get('key4'); // miss

      const stats = cacheService.getCacheStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe('50.00%');
    });

    it('should show 100% hit rate when all hits', async () => {
      await cacheService.set('key', 'value');
      await cacheService.get('key');
      await cacheService.get('key');
      await cacheService.get('key');

      const stats = cacheService.getCacheStats();

      expect(stats.hitRate).toBe('100.00%');
    });

    it('should show 0% hit rate when all misses', async () => {
      await cacheService.get('missing1');
      await cacheService.get('missing2');

      const stats = cacheService.getCacheStats();

      expect(stats.hitRate).toBe('0.00%');
    });

    it('should track number of keys', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.set('key3', 'value3');

      const stats = cacheService.getCacheStats();

      expect(stats.keys).toBe(3);
    });

    it('should update keys count after delete', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.delete('key1');

      const stats = cacheService.getCacheStats();

      expect(stats.keys).toBe(1);
    });

    it('should include NodeCache internal stats', () => {
      const stats = cacheService.getCacheStats();

      expect(stats.size).toBeDefined();
      expect(stats.size).toHaveProperty('hits');
      expect(stats.size).toHaveProperty('misses');
    });
  });

  describe('getConfig', () => {
    it('should return config for known cache type', () => {
      const config = cacheService.getConfig('promptOptimization');

      expect(config).toEqual({
        ttl: 3600,
        namespace: 'prompt',
      });
    });

    it('should return default config for unknown cache type', () => {
      const config = cacheService.getConfig('unknownType');

      expect(config).toEqual({
        ttl: 3600, // default TTL
        namespace: 'default',
      });
    });

    it('should return all cache type configs correctly', () => {
      expect(cacheService.getConfig('promptOptimization').namespace).toBe('prompt');
      expect(cacheService.getConfig('questionGeneration').namespace).toBe('questions');
      expect(cacheService.getConfig('enhancement').namespace).toBe('enhancement');
      expect(cacheService.getConfig('sceneDetection').namespace).toBe('scene');
      expect(cacheService.getConfig('creative').namespace).toBe('creative');
    });

    it('should return correct TTL for creative cache', () => {
      const config = cacheService.getConfig('creative');

      expect(config.ttl).toBe(7200); // 2 hours
    });

    it('should return correct TTL for question generation', () => {
      const config = cacheService.getConfig('questionGeneration');

      expect(config.ttl).toBe(1800); // 30 minutes
    });
  });

  describe('isHealthy', () => {
    it('should return healthy status when cache is working', () => {
      const health = cacheService.isHealthy();

      expect(health.healthy).toBe(true);
      expect(health.stats).toBeDefined();
    });

    it('should include stats in health check response', () => {
      const health = cacheService.isHealthy();

      expect(health.stats).toHaveProperty('hits');
      expect(health.stats).toHaveProperty('misses');
      expect(health.stats).toHaveProperty('hitRate');
    });

    it('should not interfere with actual cache operations', async () => {
      await cacheService.set('test-key', 'test-value');

      cacheService.isHealthy();

      const value = await cacheService.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should clean up health check key', () => {
      cacheService.isHealthy();

      const keys = cacheService.cache.keys();
      expect(keys).not.toContain('health-check');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string as key', async () => {
      await cacheService.set('', 'empty key value');

      const result = await cacheService.get('');
      expect(result).toBe('empty key value');
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(1000);
      await cacheService.set(longKey, 'value');

      const result = await cacheService.get(longKey);
      expect(result).toBe('value');
    });

    it('should handle very large values', async () => {
      const largeValue = {
        data: 'x'.repeat(100000),
        nested: { array: new Array(1000).fill('item') },
      };

      await cacheService.set('large', largeValue);

      const result = await cacheService.get('large');
      expect(result.data.length).toBe(100000);
      expect(result.nested.array.length).toBe(1000);
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with:colons/and/slashes@symbols#hash';
      await cacheService.set(specialKey, 'value');

      const result = await cacheService.get(specialKey);
      expect(result).toBe('value');
    });

    it('should handle very short TTL (near-immediate expiration)', async () => {
      await cacheService.set('immediate', 'value', { ttl: 1 });

      // Should be available immediately
      const immediateResult = await cacheService.get('immediate');
      expect(immediateResult).toBe('value');

      // Should expire after 1 second
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const expiredResult = await cacheService.get('immediate');
      expect(expiredResult).toBeNull();
    });

    it('should handle concurrent reads and writes', async () => {
      const promises = [];

      // Concurrent writes
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`key${i}`, `value${i}`));
      }

      // Concurrent reads
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.get(`key${i}`));
      }

      await Promise.all(promises);

      // Verify all values are stored correctly
      for (let i = 0; i < 10; i++) {
        const value = await cacheService.get(`key${i}`);
        expect(value).toBe(`value${i}`);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should support typical cache workflow for prompt optimization', async () => {
      const config = cacheService.getConfig('promptOptimization');
      const prompt = { text: 'Optimize this prompt', mode: 'creative' };
      const key = cacheService.generateKey(config.namespace, prompt);

      // First request - cache miss
      let cached = await cacheService.get(key, 'promptOptimization');
      expect(cached).toBeNull();

      // Store result
      const optimizedResult = { text: 'Optimized prompt', score: 0.95 };
      await cacheService.set(key, optimizedResult, { ttl: config.ttl });

      // Second request - cache hit
      cached = await cacheService.get(key, 'promptOptimization');
      expect(cached).toEqual(optimizedResult);
    });

    it('should improve hit rate over time with semantic caching', async () => {
      // Similar prompts should generate similar keys (mocked behavior)
      const prompt1 = { text: 'hello world' };
      const prompt2 = { text: 'hello world' };

      const key1 = cacheService.generateKey('test', prompt1);
      const key2 = cacheService.generateKey('test', prompt2);

      // Semantic enhancer should generate same key for similar prompts
      expect(SemanticCacheEnhancer.generateSemanticKey).toHaveBeenCalledTimes(2);
      expect(key1).toBe(key2);
    });

    it('should handle cache warming scenario', async () => {
      // Warm cache with common queries
      const commonQueries = [
        { type: 'greeting', text: 'hello' },
        { type: 'farewell', text: 'goodbye' },
        { type: 'help', text: 'how can I' },
      ];

      for (const query of commonQueries) {
        const key = cacheService.generateKey('common', query, {
          useSemantic: false,
        });
        await cacheService.set(key, { response: `Response for ${query.type}` });
      }

      const stats = cacheService.getCacheStats();
      expect(stats.keys).toBe(3);
      expect(stats.sets).toBe(3);
    });

    it('should handle cache invalidation pattern', async () => {
      // Set multiple related entries
      await cacheService.set('user:1:profile', { name: 'Alice' });
      await cacheService.set('user:1:settings', { theme: 'dark' });
      await cacheService.set('user:1:preferences', { lang: 'en' });

      // Invalidate all user:1 entries
      const keys = cacheService.cache.keys();
      const userKeys = keys.filter((k) => k.startsWith('user:1:'));

      for (const key of userKeys) {
        await cacheService.delete(key);
      }

      // Verify all deleted
      expect(await cacheService.get('user:1:profile')).toBeNull();
      expect(await cacheService.get('user:1:settings')).toBeNull();
      expect(await cacheService.get('user:1:preferences')).toBeNull();
    });
  });
});
