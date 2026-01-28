import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from '../CacheService';

// Mock NodeCache
vi.mock('node-cache', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn().mockReturnValue(true),
    del: vi.fn().mockReturnValue(1),
    flushAll: vi.fn(),
    keys: vi.fn().mockReturnValue([]),
    getStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, keys: 0 }),
    on: vi.fn(),
    options: { stdTTL: 3600 },
  })),
}));

// Mock logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics service
vi.mock('@infrastructure/MetricsService', () => ({
  metricsService: {
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    updateCacheHitRate: vi.fn(),
  },
}));

// Mock semantic cache enhancer
vi.mock('../SemanticCacheService.js', () => ({
  SemanticCacheEnhancer: {
    generateSemanticKey: vi.fn((namespace: string, data: unknown) => `semantic:${namespace}:${JSON.stringify(data).substring(0, 10)}`),
  },
}));

import { metricsService } from '@infrastructure/MetricsService';

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns null when cache returns undefined', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.get.mockReturnValue(undefined);

      const result = await service.get<string>('key');

      expect(result).toBeNull();
    });

    it('returns false when cache set fails', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.set.mockReturnValue(false);

      const success = await service.set('key', 'value');

      expect(success).toBe(false);
    });

    it('handles health check failure gracefully', () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.set.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = service.isHealthy();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Cache error');
    });
  });

  describe('edge cases', () => {
    it('handles empty configuration', () => {
      const service = new CacheService();

      expect(service).toBeDefined();
    });

    it('uses custom TTL from configuration', () => {
      const service = new CacheService({ defaultTTL: 7200 });

      expect(service).toBeDefined();
    });

    it('returns default config when type not found', () => {
      const service = new CacheService();

      const config = service.getConfig('unknown');

      expect(config.namespace).toBe('default');
    });

    it('returns specific config when type exists', () => {
      const service = new CacheService({
        promptOptimization: { ttl: 5000, namespace: 'custom-prompt' },
      });

      const config = service.getConfig('promptOptimization');

      expect(config.ttl).toBe(5000);
      expect(config.namespace).toBe('custom-prompt');
    });
  });

  describe('cache operations', () => {
    it('records cache hit and updates metrics', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.get.mockReturnValue({ data: 'cached' });

      const result = await service.get<{ data: string }>('key', 'test-type');

      expect(result).toEqual({ data: 'cached' });
      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('test-type');
      expect(metricsService.updateCacheHitRate).toHaveBeenCalled();
    });

    it('records cache miss and updates metrics', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.get.mockReturnValue(undefined);

      const result = await service.get<string>('key', 'test-type');

      expect(result).toBeNull();
      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('test-type');
    });

    it('sets value with custom TTL', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;

      await service.set('key', 'value', { ttl: 1800 });

      expect(internalCache.set).toHaveBeenCalledWith('key', 'value', 1800);
    });

    it('deletes key from cache', async () => {
      const service = new CacheService();

      const deleted = await service.delete('key');

      expect(deleted).toBe(1);
    });

    it('flushes all cache entries', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;

      await service.flush();

      expect(internalCache.flushAll).toHaveBeenCalled();
    });
  });

  describe('key generation', () => {
    it('generates semantic key by default', () => {
      const service = new CacheService();

      const key = service.generateKey('namespace', { prompt: 'test' });

      expect(key).toContain('semantic:');
    });

    it('generates standard key when useSemantic is false', () => {
      const service = new CacheService();

      const key = service.generateKey('namespace', { prompt: 'test' }, { useSemantic: false });

      expect(key).toMatch(/^namespace:[a-f0-9]{16}$/);
    });

    it('generates consistent keys for same input', () => {
      const service = new CacheService();
      const data = { prompt: 'same' };

      const key1 = service.generateKey('ns', data, { useSemantic: false });
      const key2 = service.generateKey('ns', data, { useSemantic: false });

      expect(key1).toBe(key2);
    });
  });

  describe('statistics', () => {
    it('tracks hits and misses', async () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;

      // Simulate hits
      internalCache.get.mockReturnValue('value');
      await service.get('key1');
      await service.get('key2');

      // Simulate miss
      internalCache.get.mockReturnValue(undefined);
      await service.get('key3');

      const stats = service.getCacheStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });

    it('tracks sets', async () => {
      const service = new CacheService();

      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      const stats = service.getCacheStats();

      expect(stats.sets).toBe(2);
    });

    it('returns 0% hit rate when no operations', () => {
      const service = new CacheService();

      const stats = service.getCacheStats();

      expect(stats.hitRate).toBe('0.00%');
    });
  });

  describe('health check', () => {
    it('returns healthy status when cache works', () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.get.mockReturnValue('ok');

      const result = service.isHealthy();

      expect(result.healthy).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('returns unhealthy status when cache fails', () => {
      const service = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (service as any).cache;
      internalCache.get.mockReturnValue('not-ok');

      const result = service.isHealthy();

      expect(result.healthy).toBe(false);
    });
  });
});
