/**
 * Cache Statistics Tracker
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache statistics
 * - DIP: Depends on IMetricsCollector abstraction
 */
export class CacheStatisticsTracker {
  constructor({ metricsCollector = null }) {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
    this.metricsCollector = metricsCollector;
  }

  recordHit(cacheType = 'default') {
    this.stats.hits++;
    this.metricsCollector?.recordCacheHit?.(cacheType);
    this._updateHitRate(cacheType);
  }

  recordMiss(cacheType = 'default') {
    this.stats.misses++;
    this.metricsCollector?.recordCacheMiss?.(cacheType);
    this._updateHitRate(cacheType);
  }

  recordSet() {
    this.stats.sets++;
  }

  getStatistics() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: hitRate.toFixed(2) + '%',
    };
  }

  _updateHitRate(cacheType) {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    this.metricsCollector?.updateCacheHitRate?.(cacheType, hitRate);
  }
}
