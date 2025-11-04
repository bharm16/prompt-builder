import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheStatisticsTracker } from '../../../../../server/src/services/cache/CacheStatisticsTracker.js';

describe('CacheStatisticsTracker', () => {
  let tracker;
  let mockMetricsCollector;

  beforeEach(() => {
    mockMetricsCollector = {
      recordCacheHit: vi.fn(),
      recordCacheMiss: vi.fn(),
      updateCacheHitRate: vi.fn(),
    };
    tracker = new CacheStatisticsTracker({ metricsCollector: mockMetricsCollector });
  });

  describe('constructor', () => {
    it('should initialize with zero stats', () => {
      const stats = tracker.getStatistics();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.hitRate).toBe('0.00%');
    });

    it('should accept metrics collector in constructor', () => {
      expect(tracker.metricsCollector).toBe(mockMetricsCollector);
    });

    it('should work without metrics collector', () => {
      const trackerWithoutMetrics = new CacheStatisticsTracker({});

      expect(() => trackerWithoutMetrics.recordHit()).not.toThrow();
      expect(() => trackerWithoutMetrics.recordMiss()).not.toThrow();
    });

    it('should work with null metrics collector', () => {
      const trackerWithNull = new CacheStatisticsTracker({ metricsCollector: null });

      expect(() => trackerWithNull.recordHit()).not.toThrow();
      expect(() => trackerWithNull.recordMiss()).not.toThrow();
    });
  });

  describe('recordHit', () => {
    it('should increment hit counter', () => {
      tracker.recordHit();

      const stats = tracker.getStatistics();
      expect(stats.hits).toBe(1);
    });

    it('should increment hit counter multiple times', () => {
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordHit();

      const stats = tracker.getStatistics();
      expect(stats.hits).toBe(3);
    });

    it('should call metricsCollector.recordCacheHit with default cache type', () => {
      tracker.recordHit();

      expect(mockMetricsCollector.recordCacheHit).toHaveBeenCalledWith('default');
    });

    it('should call metricsCollector.recordCacheHit with custom cache type', () => {
      tracker.recordHit('semantic');

      expect(mockMetricsCollector.recordCacheHit).toHaveBeenCalledWith('semantic');
    });

    it('should update hit rate after recording hit', () => {
      tracker.recordHit();

      expect(mockMetricsCollector.updateCacheHitRate).toHaveBeenCalled();
    });

    it('should calculate 100% hit rate with only hits', () => {
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordHit();

      const stats = tracker.getStatistics();
      expect(stats.hitRate).toBe('100.00%');
    });

    it('should not throw if metricsCollector methods are missing', () => {
      const trackerWithPartialMetrics = new CacheStatisticsTracker({
        metricsCollector: { recordCacheHit: vi.fn() },
      });

      expect(() => trackerWithPartialMetrics.recordHit()).not.toThrow();
    });
  });

  describe('recordMiss', () => {
    it('should increment miss counter', () => {
      tracker.recordMiss();

      const stats = tracker.getStatistics();
      expect(stats.misses).toBe(1);
    });

    it('should increment miss counter multiple times', () => {
      tracker.recordMiss();
      tracker.recordMiss();
      tracker.recordMiss();

      const stats = tracker.getStatistics();
      expect(stats.misses).toBe(3);
    });

    it('should call metricsCollector.recordCacheMiss with default cache type', () => {
      tracker.recordMiss();

      expect(mockMetricsCollector.recordCacheMiss).toHaveBeenCalledWith('default');
    });

    it('should call metricsCollector.recordCacheMiss with custom cache type', () => {
      tracker.recordMiss('prompt');

      expect(mockMetricsCollector.recordCacheMiss).toHaveBeenCalledWith('prompt');
    });

    it('should update hit rate after recording miss', () => {
      tracker.recordMiss();

      expect(mockMetricsCollector.updateCacheHitRate).toHaveBeenCalled();
    });

    it('should calculate 0% hit rate with only misses', () => {
      tracker.recordMiss();
      tracker.recordMiss();
      tracker.recordMiss();

      const stats = tracker.getStatistics();
      expect(stats.hitRate).toBe('0.00%');
    });
  });

  describe('recordSet', () => {
    it('should increment set counter', () => {
      tracker.recordSet();

      const stats = tracker.getStatistics();
      expect(stats.sets).toBe(1);
    });

    it('should increment set counter multiple times', () => {
      tracker.recordSet();
      tracker.recordSet();
      tracker.recordSet();

      const stats = tracker.getStatistics();
      expect(stats.sets).toBe(3);
    });

    it('should not affect hit rate', () => {
      tracker.recordHit();
      tracker.recordMiss();
      const hitRateBefore = tracker.getStatistics().hitRate;

      tracker.recordSet();
      tracker.recordSet();

      const hitRateAfter = tracker.getStatistics().hitRate;
      expect(hitRateAfter).toBe(hitRateBefore);
    });

    it('should not call metricsCollector', () => {
      tracker.recordSet();

      expect(mockMetricsCollector.recordCacheHit).not.toHaveBeenCalled();
      expect(mockMetricsCollector.recordCacheMiss).not.toHaveBeenCalled();
      expect(mockMetricsCollector.updateCacheHitRate).not.toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return all statistics', () => {
      const stats = tracker.getStatistics();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should return correct statistics after mixed operations', () => {
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordSet();
      tracker.recordSet();
      tracker.recordSet();

      const stats = tracker.getStatistics();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(3);
    });

    it('should format hit rate as percentage string', () => {
      tracker.recordHit();
      tracker.recordMiss();

      const stats = tracker.getStatistics();

      expect(typeof stats.hitRate).toBe('string');
      expect(stats.hitRate).toMatch(/^\d+\.\d{2}%$/);
    });

    it('should calculate hit rate correctly', () => {
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordMiss();

      const stats = tracker.getStatistics();

      // 3 hits, 1 miss = 75% hit rate
      expect(stats.hitRate).toBe('75.00%');
    });

    it('should handle edge case of 0 total requests', () => {
      const stats = tracker.getStatistics();

      expect(stats.hitRate).toBe('0.00%');
    });

    it('should round hit rate to 2 decimal places', () => {
      // 1 hit, 2 misses = 33.333...% -> should be 33.33%
      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordMiss();

      const stats = tracker.getStatistics();

      expect(stats.hitRate).toBe('33.33%');
    });

    it('should handle very small hit rates', () => {
      tracker.recordHit();
      for (let i = 0; i < 99; i++) {
        tracker.recordMiss();
      }

      const stats = tracker.getStatistics();

      // 1 hit, 99 misses = 1% hit rate
      expect(stats.hitRate).toBe('1.00%');
    });

    it('should not mutate internal state when called', () => {
      tracker.recordHit();
      const stats1 = tracker.getStatistics();
      const stats2 = tracker.getStatistics();

      expect(stats1.hits).toBe(stats2.hits);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('_updateHitRate', () => {
    it('should call metricsCollector.updateCacheHitRate with correct values', () => {
      tracker.recordHit();
      tracker.recordMiss();

      const lastCall = mockMetricsCollector.updateCacheHitRate.mock.calls[
        mockMetricsCollector.updateCacheHitRate.mock.calls.length - 1
      ];

      expect(lastCall[0]).toBe('default'); // cache type
      expect(lastCall[1]).toBe(50); // hit rate
    });

    it('should pass correct cache type to metricsCollector', () => {
      tracker.recordHit('semantic');

      const calls = mockMetricsCollector.updateCacheHitRate.mock.calls;
      expect(calls[0][0]).toBe('semantic');
    });

    it('should calculate hit rate from stats', () => {
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordMiss();

      const lastCall = mockMetricsCollector.updateCacheHitRate.mock.calls[
        mockMetricsCollector.updateCacheHitRate.mock.calls.length - 1
      ];

      expect(lastCall[1]).toBe(75); // 3/4 = 75%
    });

    it('should handle division by zero gracefully', () => {
      const newTracker = new CacheStatisticsTracker({ metricsCollector: mockMetricsCollector });

      // No hits or misses yet - should handle gracefully
      expect(() => newTracker.recordHit()).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should track cache performance over time', () => {
      // Simulate cache warming up
      for (let i = 0; i < 10; i++) {
        tracker.recordMiss();
        tracker.recordSet();
      }

      let stats = tracker.getStatistics();
      expect(stats.hitRate).toBe('0.00%');
      expect(stats.sets).toBe(10);

      // After warming, more hits
      for (let i = 0; i < 20; i++) {
        tracker.recordHit();
      }

      stats = tracker.getStatistics();
      expect(stats.hitRate).toBe('66.67%'); // 20 hits / 30 total
    });

    it('should work with different cache types', () => {
      tracker.recordHit('prompt');
      tracker.recordHit('semantic');
      tracker.recordMiss('prompt');
      tracker.recordMiss('semantic');

      expect(mockMetricsCollector.recordCacheHit).toHaveBeenCalledWith('prompt');
      expect(mockMetricsCollector.recordCacheHit).toHaveBeenCalledWith('semantic');
      expect(mockMetricsCollector.recordCacheMiss).toHaveBeenCalledWith('prompt');
      expect(mockMetricsCollector.recordCacheMiss).toHaveBeenCalledWith('semantic');
    });

    it('should maintain accurate counts under heavy load', () => {
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (i % 2 === 0) {
          tracker.recordHit();
        } else {
          tracker.recordMiss();
        }
        if (i % 3 === 0) {
          tracker.recordSet();
        }
      }

      const stats = tracker.getStatistics();

      expect(stats.hits).toBe(500);
      expect(stats.misses).toBe(500);
      expect(stats.sets).toBe(334);
      expect(stats.hitRate).toBe('50.00%');
    });

    it('should support resetting by creating new instance', () => {
      tracker.recordHit();
      tracker.recordHit();
      tracker.recordMiss();

      const stats1 = tracker.getStatistics();
      expect(stats1.hits).toBe(2);

      // Reset by creating new instance
      tracker = new CacheStatisticsTracker({ metricsCollector: mockMetricsCollector });

      const stats2 = tracker.getStatistics();
      expect(stats2.hits).toBe(0);
      expect(stats2.misses).toBe(0);
      expect(stats2.sets).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers of operations', () => {
      const largeNumber = 1000000;

      for (let i = 0; i < largeNumber; i++) {
        tracker.recordHit();
      }

      const stats = tracker.getStatistics();
      expect(stats.hits).toBe(largeNumber);
    });

    it('should handle rapid successive calls', () => {
      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordSet();
      tracker.recordSet();

      const stats = tracker.getStatistics();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.sets).toBe(2);
      expect(stats.hitRate).toBe('50.00%');
    });

    it('should handle metrics collector without optional methods', () => {
      const minimalMetrics = {};
      const minimalTracker = new CacheStatisticsTracker({ metricsCollector: minimalMetrics });

      expect(() => {
        minimalTracker.recordHit();
        minimalTracker.recordMiss();
        minimalTracker.recordSet();
      }).not.toThrow();
    });

    it('should use optional chaining for metrics collector calls', () => {
      // If metricsCollector is undefined
      const trackerNoMetrics = new CacheStatisticsTracker({});

      expect(() => {
        trackerNoMetrics.recordHit();
        trackerNoMetrics.recordMiss();
      }).not.toThrow();

      // Stats should still work
      const stats = trackerNoMetrics.getStatistics();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should handle concurrent-like sequential calls', () => {
      // Simulate what might happen in concurrent scenario
      const operations = [
        () => tracker.recordHit(),
        () => tracker.recordMiss(),
        () => tracker.recordSet(),
        () => tracker.recordHit(),
        () => tracker.recordMiss(),
      ];

      operations.forEach(op => op());

      const stats = tracker.getStatistics();
      expect(stats.hits + stats.misses + stats.sets).toBe(5);
    });
  });

  describe('getStatistics return format', () => {
    it('should always return percentage with exactly 2 decimal places', () => {
      const testCases = [
        { hits: 1, misses: 3, expected: '25.00%' },
        { hits: 2, misses: 1, expected: '66.67%' },
        { hits: 5, misses: 5, expected: '50.00%' },
        { hits: 1, misses: 0, expected: '100.00%' },
        { hits: 0, misses: 1, expected: '0.00%' },
      ];

      testCases.forEach(({ hits, misses, expected }) => {
        const testTracker = new CacheStatisticsTracker({ metricsCollector: mockMetricsCollector });

        for (let i = 0; i < hits; i++) testTracker.recordHit();
        for (let i = 0; i < misses; i++) testTracker.recordMiss();

        const stats = testTracker.getStatistics();
        expect(stats.hitRate).toBe(expected);
      });
    });

    it('should return numbers for hits, misses, and sets', () => {
      tracker.recordHit();
      tracker.recordMiss();
      tracker.recordSet();

      const stats = tracker.getStatistics();

      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.sets).toBe('number');
    });
  });
});
