import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordCacheHit, recordCacheMiss, type SpanLabelingCacheMetrics } from '../metrics';

const createMockMetrics = (): SpanLabelingCacheMetrics => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
  recordHistogram: vi.fn(),
});

describe('recordCacheHit', () => {
  let metrics: SpanLabelingCacheMetrics;

  beforeEach(() => {
    metrics = createMockMetrics();
  });

  describe('error handling', () => {
    it('handles empty cache type', () => {
      recordCacheHit(metrics, '');

      expect(metrics.recordCacheHit).toHaveBeenCalledWith('');
    });

    it('handles undefined metrics gracefully', () => {
      // Should not throw
      recordCacheHit(undefined, 'redis', 10);
    });
  });

  describe('edge cases', () => {
    it('records duration when provided', () => {
      recordCacheHit(metrics, 'memory-lru', 15);

      expect(metrics.recordCacheHit).toHaveBeenCalledWith('memory-lru');
      expect(metrics.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', 15);
    });

    it('does not record duration when undefined', () => {
      recordCacheHit(metrics, 'memory-lru');

      expect(metrics.recordCacheHit).toHaveBeenCalledWith('memory-lru');
      expect(metrics.recordHistogram).not.toHaveBeenCalled();
    });

    it('records zero duration', () => {
      recordCacheHit(metrics, 'memory-lru', 0);

      expect(metrics.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', 0);
    });

    it('records negative duration (edge case)', () => {
      recordCacheHit(metrics, 'memory-lru', -5);

      expect(metrics.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', -5);
    });

    it('records very large duration', () => {
      recordCacheHit(metrics, 'memory-lru', 10000);

      expect(metrics.recordHistogram).toHaveBeenCalledWith('cache_retrieval_time_ms', 10000);
    });
  });

  describe('core behavior', () => {
    it('records hit with cache type', () => {
      recordCacheHit(metrics, 'redis');

      expect(metrics.recordCacheHit).toHaveBeenCalledWith('redis');
      expect(metrics.recordCacheHit).toHaveBeenCalledTimes(1);
    });

    it('records hit for different cache types', () => {
      recordCacheHit(metrics, 'memory');
      recordCacheHit(metrics, 'redis');
      recordCacheHit(metrics, 'semantic');

      expect(metrics.recordCacheHit).toHaveBeenCalledWith('memory');
      expect(metrics.recordCacheHit).toHaveBeenCalledWith('redis');
      expect(metrics.recordCacheHit).toHaveBeenCalledWith('semantic');
    });
  });
});

describe('recordCacheMiss', () => {
  let metrics: SpanLabelingCacheMetrics;

  beforeEach(() => {
    metrics = createMockMetrics();
  });

  describe('error handling', () => {
    it('handles empty cache type', () => {
      recordCacheMiss(metrics, '');

      expect(metrics.recordCacheMiss).toHaveBeenCalledWith('');
    });

    it('handles undefined metrics gracefully', () => {
      // Should not throw
      recordCacheMiss(undefined, 'redis');
    });
  });

  describe('core behavior', () => {
    it('records miss with cache type', () => {
      recordCacheMiss(metrics, 'redis');

      expect(metrics.recordCacheMiss).toHaveBeenCalledWith('redis');
      expect(metrics.recordCacheMiss).toHaveBeenCalledTimes(1);
    });

    it('records miss for different cache types', () => {
      recordCacheMiss(metrics, 'memory');
      recordCacheMiss(metrics, 'redis');
      recordCacheMiss(metrics, 'semantic');

      expect(metrics.recordCacheMiss).toHaveBeenCalledWith('memory');
      expect(metrics.recordCacheMiss).toHaveBeenCalledWith('redis');
      expect(metrics.recordCacheMiss).toHaveBeenCalledWith('semantic');
    });
  });
});
