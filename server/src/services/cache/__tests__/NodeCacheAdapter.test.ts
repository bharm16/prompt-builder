import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeCacheAdapter } from '../NodeCacheAdapter';

// Mock NodeCache
vi.mock('node-cache', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn().mockReturnValue(true),
    del: vi.fn().mockReturnValue(1),
    flushAll: vi.fn(),
    on: vi.fn(),
    options: { stdTTL: 3600 },
  })),
}));

function createMockKeyGenerator() {
  return {
    generate: vi.fn((namespace: string, data: Record<string, unknown>) => {
      return `${namespace}:${JSON.stringify(data).substring(0, 10)}`;
    }),
  };
}

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('NodeCacheAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles cache get returning undefined', async () => {
      const keyGenerator = createMockKeyGenerator();
      const adapter = new NodeCacheAdapter({ keyGenerator });

      // The mock returns undefined by default for .get()
      const result = await adapter.get<string>('nonexistent');

      expect(result).toBeNull();
    });

    it('handles cache set failure', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // Access internal cache to mock set failure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;
      internalCache.set.mockReturnValue(false);

      const success = await adapter.set('key', 'value');

      expect(success).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('Cache set failed', { key: 'key' });
    });

    it('handles health check failure gracefully', () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;
      internalCache.set.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const healthy = adapter.isHealthy();

      expect(healthy).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Cache health check failed', expect.any(Error));
    });
  });

  describe('edge cases', () => {
    it('handles null logger gracefully', async () => {
      const keyGenerator = createMockKeyGenerator();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger: null });

      // Should not throw
      await adapter.get('key');
      await adapter.set('key', 'value');
      await adapter.delete('key');
      await adapter.flush();
    });

    it('handles custom TTL in set options', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;

      await adapter.set('key', 'value', { ttl: 120 });

      expect(internalCache.set).toHaveBeenCalledWith('key', 'value', 120);
    });

    it('uses default TTL when not specified in options', async () => {
      const keyGenerator = createMockKeyGenerator();
      const adapter = new NodeCacheAdapter({ keyGenerator });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;

      await adapter.set('key', 'value');

      expect(internalCache.set).toHaveBeenCalledWith('key', 'value', 3600);
    });

    it('handles delete returning 0 (key not found)', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;
      internalCache.del.mockReturnValue(0);

      const deleted = await adapter.delete('nonexistent');

      expect(deleted).toBe(0);
      expect(logger.debug).not.toHaveBeenCalledWith('Cache key deleted', expect.anything());
    });
  });

  describe('core behavior', () => {
    it('returns cached value on hit', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;
      internalCache.get.mockReturnValue({ data: 'cached' });

      const result = await adapter.get<{ data: string }>('key');

      expect(result).toEqual({ data: 'cached' });
      expect(logger.debug).toHaveBeenCalledWith('Cache hit', { key: 'key' });
    });

    it('returns null on cache miss', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;
      internalCache.get.mockReturnValue(undefined);

      const result = await adapter.get<string>('key');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Cache miss', { key: 'key' });
    });

    it('sets value in cache', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      const success = await adapter.set('key', 'value');

      expect(success).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith('Cache set', { key: 'key', ttl: 3600 });
    });

    it('deletes key from cache', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      const deleted = await adapter.delete('key');

      expect(deleted).toBe(1);
      expect(logger.debug).toHaveBeenCalledWith('Cache key deleted', { key: 'key' });
    });

    it('flushes all cache entries', async () => {
      const keyGenerator = createMockKeyGenerator();
      const logger = createMockLogger();
      const adapter = new NodeCacheAdapter({ keyGenerator, logger });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;

      await adapter.flush();

      expect(internalCache.flushAll).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Cache flushed');
    });

    it('generates key using key generator', () => {
      const keyGenerator = createMockKeyGenerator();
      const adapter = new NodeCacheAdapter({ keyGenerator });

      const key = adapter.generateKey('namespace', { prompt: 'test' });

      expect(keyGenerator.generate).toHaveBeenCalledWith('namespace', { prompt: 'test' });
      expect(key).toContain('namespace:');
    });

    it('returns healthy status when cache works', () => {
      const keyGenerator = createMockKeyGenerator();
      const adapter = new NodeCacheAdapter({ keyGenerator });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalCache = (adapter as any).cache;
      internalCache.get.mockReturnValue('ok');

      const healthy = adapter.isHealthy();

      expect(healthy).toBe(true);
    });
  });

  describe('configuration', () => {
    it('accepts custom default TTL from config', () => {
      const keyGenerator = createMockKeyGenerator();

      // Should not throw with custom config
      const adapter = new NodeCacheAdapter({
        keyGenerator,
        config: { defaultTTL: 7200 },
      });

      expect(adapter).toBeDefined();
    });

    it('accepts custom check period from config', () => {
      const keyGenerator = createMockKeyGenerator();

      // Should not throw with custom config
      const adapter = new NodeCacheAdapter({
        keyGenerator,
        config: { checkperiod: 300 },
      });

      expect(adapter).toBeDefined();
    });
  });
});
