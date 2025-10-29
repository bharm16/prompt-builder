/**
 * Metrics Collector Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Focused interface for metrics collection
 * - DIP: Abstraction for metrics operations
 */
export class IMetricsCollector {
  /**
   * Record successful operation
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  recordSuccess(operation, duration) {
    throw new Error('recordSuccess() must be implemented');
  }

  /**
   * Record failed operation
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  recordFailure(operation, duration) {
    throw new Error('recordFailure() must be implemented');
  }

  /**
   * Record cache hit
   * @param {string} cacheType - Cache type
   */
  recordCacheHit(cacheType) {
    throw new Error('recordCacheHit() must be implemented');
  }

  /**
   * Record cache miss
   * @param {string} cacheType - Cache type
   */
  recordCacheMiss(cacheType) {
    throw new Error('recordCacheMiss() must be implemented');
  }

  /**
   * Update cache hit rate
   * @param {string} cacheType - Cache type
   * @param {number} hitRate - Hit rate percentage
   */
  updateCacheHitRate(cacheType, hitRate) {
    throw new Error('updateCacheHitRate() must be implemented');
  }
}
