/**
 * Metrics Collector Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Focused interface for metrics collection
 * - DIP: Abstraction for metrics operations
 */

export interface IMetricsCollector {
  /**
   * Record successful operation
   */
  recordSuccess(operation: string, duration: number): void;

  /**
   * Record failed operation
   */
  recordFailure(operation: string, duration: number): void;

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string): void;

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string): void;

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(cacheType: string, hitRate: number): void;
}

