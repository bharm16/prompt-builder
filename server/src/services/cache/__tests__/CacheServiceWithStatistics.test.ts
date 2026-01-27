import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheServiceWithStatistics } from '../CacheServiceWithStatistics';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

function createMockCacheService() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(1),
    flush: vi.fn().mockResolvedValue(undefined),
    generateKey: vi.fn((namespace: string, data: Record<string, unknown>) => `${namespace}:${JSON.stringify(data)}`),
    isHealthy: vi.fn().mockReturnValue(true),
  };
}

function createMockStatisticsTracker() {
  return {
    recordHit: vi.fn(),
    recordMiss: vi.fn(),
    recordSet: vi.fn(),
    getStatistics: vi.fn().mockReturnValue({
      hits: 10,
      misses: 5,
      sets: 8,
      hitRate: '66.67%',
    }),
  };
}

describe('CacheServiceWithStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns null and records miss when underlying cache returns null', async () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const result = await service.get<string>('key');

      expect(result).toBeNull();
      expect(mockStats.recordMiss).toHaveBeenCalledWith('default');
    });

    it('does not record set when underlying set fails', async () => {
      const mockCache = createMockCacheService();
      mockCache.set.mockResolvedValue(false);
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const success = await service.set('key', 'value');

      expect(success).toBe(false);
      expect(mockStats.recordSet).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('uses default cache type when not specified', async () => {
      const mockCache = createMockCacheService();
      mockCache.get.mockResolvedValue('value');
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await service.get('key');

      expect(mockStats.recordHit).toHaveBeenCalledWith('default');
    });

    it('uses custom cache type for statistics', async () => {
      const mockCache = createMockCacheService();
      mockCache.get.mockResolvedValue('value');
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await service.get('key', 'custom-cache');

      expect(mockStats.recordHit).toHaveBeenCalledWith('custom-cache');
    });

    it('handles flush when underlying cache has no flush method', async () => {
      const mockCache = createMockCacheService();
      delete (mockCache as { flush?: unknown }).flush;
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await expect(service.flush()).resolves.toBeUndefined();
    });

    it('returns true for isHealthy when underlying cache has no isHealthy method', () => {
      const mockCache = createMockCacheService();
      delete (mockCache as { isHealthy?: unknown }).isHealthy;
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      expect(service.isHealthy()).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('records hit when cache returns value', async () => {
      const mockCache = createMockCacheService();
      mockCache.get.mockResolvedValue({ data: 'cached' });
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const result = await service.get<{ data: string }>('key');

      expect(result).toEqual({ data: 'cached' });
      expect(mockStats.recordHit).toHaveBeenCalledWith('default');
      expect(mockStats.recordMiss).not.toHaveBeenCalled();
    });

    it('records miss when cache returns null', async () => {
      const mockCache = createMockCacheService();
      mockCache.get.mockResolvedValue(null);
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await service.get('key');

      expect(mockStats.recordMiss).toHaveBeenCalledWith('default');
      expect(mockStats.recordHit).not.toHaveBeenCalled();
    });

    it('records set on successful cache set', async () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const success = await service.set('key', 'value', { ttl: 60 });

      expect(success).toBe(true);
      expect(mockStats.recordSet).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('key', 'value', { ttl: 60 });
    });

    it('delegates delete to underlying cache', async () => {
      const mockCache = createMockCacheService();
      mockCache.delete.mockResolvedValue(1);
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const deleted = await service.delete('key');

      expect(deleted).toBe(1);
      expect(mockCache.delete).toHaveBeenCalledWith('key');
    });

    it('delegates flush to underlying cache', async () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await service.flush();

      expect(mockCache.flush).toHaveBeenCalled();
    });

    it('delegates generateKey to underlying cache', () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const key = service.generateKey('namespace', { data: 'test' });

      expect(mockCache.generateKey).toHaveBeenCalledWith('namespace', { data: 'test' });
      expect(key).toBe('namespace:{"data":"test"}');
    });

    it('returns statistics from tracker', () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      const stats = service.getStatistics();

      expect(stats).toEqual({
        hits: 10,
        misses: 5,
        sets: 8,
        hitRate: '66.67%',
      });
    });

    it('delegates isHealthy to underlying cache', () => {
      const mockCache = createMockCacheService();
      mockCache.isHealthy.mockReturnValue(false);
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      expect(service.isHealthy()).toBe(false);
    });
  });

  describe('options handling', () => {
    it('passes options to underlying set', async () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await service.set('key', 'value', { ttl: 1800 });

      expect(mockCache.set).toHaveBeenCalledWith('key', 'value', { ttl: 1800 });
    });

    it('uses empty options by default', async () => {
      const mockCache = createMockCacheService();
      const mockStats = createMockStatisticsTracker();
      const service = new CacheServiceWithStatistics({
        cacheService: mockCache,
        statisticsTracker: mockStats,
      });

      await service.set('key', 'value');

      expect(mockCache.set).toHaveBeenCalledWith('key', 'value', {});
    });
  });
});
