import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordCacheHit, recordCacheMiss } from '../metrics';

// Mock the metrics service
vi.mock('@infrastructure/MetricsService', () => ({
  metricsService: {
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    recordHistogram: vi.fn(),
  },
}));

import { metricsService } from '@infrastructure/MetricsService';

describe('recordCacheHit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles empty cache type', () => {
      recordCacheHit('');

      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('');
    });
  });

  describe('edge cases', () => {
    it('records duration when provided', () => {
      recordCacheHit('memory-lru', 15);

      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('memory-lru');
      expect(metricsService.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', 15);
    });

    it('does not record duration when undefined', () => {
      recordCacheHit('memory-lru');

      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('memory-lru');
      expect(metricsService.recordHistogram).not.toHaveBeenCalled();
    });

    it('records zero duration', () => {
      recordCacheHit('memory-lru', 0);

      expect(metricsService.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', 0);
    });

    it('records negative duration (edge case)', () => {
      recordCacheHit('memory-lru', -5);

      expect(metricsService.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', -5);
    });

    it('records very large duration', () => {
      recordCacheHit('memory-lru', 10000);

      expect(metricsService.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', 10000);
    });
  });

  describe('core behavior', () => {
    it('records hit with cache type', () => {
      recordCacheHit('redis');

      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('redis');
      expect(metricsService.recordCacheHit).toHaveBeenCalledTimes(1);
    });

    it('records hit for different cache types', () => {
      recordCacheHit('memory');
      recordCacheHit('redis');
      recordCacheHit('semantic');

      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('memory');
      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('redis');
      expect(metricsService.recordCacheHit).toHaveBeenCalledWith('semantic');
    });
  });
});

describe('recordCacheMiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles empty cache type', () => {
      recordCacheMiss('');

      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('');
    });
  });

  describe('core behavior', () => {
    it('records miss with cache type', () => {
      recordCacheMiss('redis');

      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('redis');
      expect(metricsService.recordCacheMiss).toHaveBeenCalledTimes(1);
    });

    it('records miss for different cache types', () => {
      recordCacheMiss('memory');
      recordCacheMiss('redis');
      recordCacheMiss('semantic');

      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('memory');
      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('redis');
      expect(metricsService.recordCacheMiss).toHaveBeenCalledWith('semantic');
    });
  });
});
