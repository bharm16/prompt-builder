import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheServiceV2 } from '../CacheServiceV2.js';

// Mock dependencies
vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/MetricsService.js', () => ({
  metricsService: {
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    updateCacheHitRate: vi.fn(),
  },
}));

describe('CacheServiceV2', () => {
  let cache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new CacheServiceV2({ defaultTTL: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates stable keys using fastHash and truncation', () => {
    const key1 = cache.generateKey('test', { prompt: 'a'.repeat(2000), mode: 'x' });
    const key2 = cache.generateKey('test', { prompt: 'a'.repeat(2000), mode: 'x' });
    expect(key1).toBe(key2);
    expect(key1.startsWith('test:')).toBe(true);
  });

  it('set/get/delete tracks stats and hit rate', async () => {
    const key = cache.generateKey('ns', { p: '1' });
    expect(await cache.get(key)).toBeNull();
    await cache.set(key, { v: 2 }, { ttl: 2 });
    const val = await cache.get(key);
    expect(val).toEqual({ v: 2 });
    await cache.delete(key);
    expect(await cache.get(key)).toBeNull();

    const stats = cache.getCacheStats();
    expect(stats.hits + stats.misses).toBeGreaterThan(0);
    expect(stats.keys).toBeGreaterThanOrEqual(0);
  });

  it('enforces memory limit by evicting entries', async () => {
    const small = new CacheServiceV2({ maxSize: 300 }); // very small for test
    const bigValue = 'x'.repeat(500);
    const k1 = small.generateKey('ns', { id: 1 });
    const k2 = small.generateKey('ns', { id: 2 });
    await small.set(k1, bigValue);
    await small.set(k2, bigValue);
    // Should have triggered some evictions due to tight limit
    const s = small.getCacheStats();
    expect(s.evictions).toBeGreaterThan(0);
  });

  it('health check reports healthy and returns stats', () => {
    const health = cache.isHealthy();
    expect(health.healthy).toBe(true);
    expect(health.stats).toBeDefined();
  });
});
