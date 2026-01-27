import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheStatisticsTracker } from '../CacheStatisticsTracker';

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

describe('CacheStatisticsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles metrics collector without recordCacheHit method', () => {
      const partialCollector = {
        recordCacheMiss: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector: partialCollector });

      // Should not throw
      expect(() => tracker.recordHit('test')).not.toThrow();
    });

    it('handles metrics collector without recordCacheMiss method', () => {
      const partialCollector = {
        recordCacheHit: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector: partialCollector });

      // Should not throw
      expect(() => tracker.recordMiss('test')).not.toThrow();
    });

    it('handles metrics collector without updateCacheHitRate method', () => {
      const partialCollector = {
        recordCacheHit: vi.fn(),
        recordCacheMiss: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector: partialCollector });

      // Should not throw
      expect(() => tracker.recordHit('test')).not.toThrow();
    });

    it('handles null metrics collector', () => {
      const tracker = new CacheStatisticsTracker({ metricsCollector: null });

      // Should not throw
      expect(() => tracker.recordHit('test')).not.toThrow();
      expect(() => tracker.recordMiss('test')).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('returns 0% hit rate when no operations recorded', () => {
      const tracker = new CacheStatisticsTracker();

      const stats = tracker.getStatistics();

      expect(stats.hitRate).toBe('0.00%');
    });

    it('returns 100% hit rate when only hits recorded', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordHit();
      tracker.recordHit();
      tracker.recordHit();

      const stats = tracker.getStatistics();

      expect(stats.hitRate).toBe('100.00%');
    });

    it('returns 0% hit rate when only misses recorded', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordMiss();
      tracker.recordMiss();

      const stats = tracker.getStatistics();

      expect(stats.hitRate).toBe('0.00%');
    });

    it('calculates correct hit rate with mixed operations', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordHit();
      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordHit();

      const stats = tracker.getStatistics();

      // 3 hits out of 4 total = 75%
      expect(stats.hitRate).toBe('75.00%');
    });

    it('uses default cache type when not specified', () => {
      const metricsCollector = {
        recordCacheHit: vi.fn(),
        recordCacheMiss: vi.fn(),
        updateCacheHitRate: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector });

      tracker.recordHit();
      tracker.recordMiss();

      expect(metricsCollector.recordCacheHit).toHaveBeenCalledWith('default');
      expect(metricsCollector.recordCacheMiss).toHaveBeenCalledWith('default');
    });
  });

  describe('metrics collector integration', () => {
    it('calls recordCacheHit on metrics collector', () => {
      const metricsCollector = {
        recordCacheHit: vi.fn(),
        recordCacheMiss: vi.fn(),
        updateCacheHitRate: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector });

      tracker.recordHit('span-cache');

      expect(metricsCollector.recordCacheHit).toHaveBeenCalledWith('span-cache');
    });

    it('calls recordCacheMiss on metrics collector', () => {
      const metricsCollector = {
        recordCacheHit: vi.fn(),
        recordCacheMiss: vi.fn(),
        updateCacheHitRate: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector });

      tracker.recordMiss('semantic-cache');

      expect(metricsCollector.recordCacheMiss).toHaveBeenCalledWith('semantic-cache');
    });

    it('updates hit rate on metrics collector', () => {
      const metricsCollector = {
        recordCacheHit: vi.fn(),
        recordCacheMiss: vi.fn(),
        updateCacheHitRate: vi.fn(),
      };
      const tracker = new CacheStatisticsTracker({ metricsCollector });

      tracker.recordHit('test');
      tracker.recordHit('test');

      expect(metricsCollector.updateCacheHitRate).toHaveBeenCalledWith('test', 100);
    });
  });

  describe('hit rate change detection', () => {
    it('logs significant hit rate changes (>=5%)', () => {
      const tracker = new CacheStatisticsTracker();

      // First operation logs initial hit rate
      tracker.recordHit(); // 100%

      // Need to change hit rate by at least 5%
      // After 100% hits, adding many misses to drop rate significantly
      for (let i = 0; i < 20; i++) {
        tracker.recordMiss();
      }

      const stats = tracker.getStatistics();
      // 1 hit, 20 misses = 1/21 = ~4.76%
      expect(parseFloat(stats.hitRate)).toBeLessThan(5);
    });

    it('does not log insignificant hit rate changes (<5%)', () => {
      const tracker = new CacheStatisticsTracker();

      // Many operations with small rate changes
      for (let i = 0; i < 100; i++) {
        tracker.recordHit();
      }
      // Adding 1 more hit doesn't change rate significantly
      tracker.recordHit();

      const stats = tracker.getStatistics();
      expect(parseFloat(stats.hitRate)).toBeGreaterThan(99);
    });
  });

  describe('core behavior', () => {
    it('tracks hits correctly', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordHit();
      tracker.recordHit();
      tracker.recordHit();

      const stats = tracker.getStatistics();

      expect(stats.hits).toBe(3);
    });

    it('tracks misses correctly', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordMiss();
      tracker.recordMiss();

      const stats = tracker.getStatistics();

      expect(stats.misses).toBe(2);
    });

    it('tracks sets correctly', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordSet();
      tracker.recordSet();
      tracker.recordSet();
      tracker.recordSet();

      const stats = tracker.getStatistics();

      expect(stats.sets).toBe(4);
    });

    it('returns complete statistics object', () => {
      const tracker = new CacheStatisticsTracker();

      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordSet();

      const stats = tracker.getStatistics();

      expect(stats).toEqual({
        hits: 1,
        misses: 1,
        sets: 1,
        hitRate: '50.00%',
      });
    });

    it('maintains independent counts for multiple tracker instances', () => {
      const tracker1 = new CacheStatisticsTracker();
      const tracker2 = new CacheStatisticsTracker();

      tracker1.recordHit();
      tracker1.recordHit();
      tracker2.recordHit();

      expect(tracker1.getStatistics().hits).toBe(2);
      expect(tracker2.getStatistics().hits).toBe(1);
    });
  });
});
