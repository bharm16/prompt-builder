import type { CacheStatistics, MetricsCollector } from './types.js';

/**
 * Cache Statistics Tracker
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache statistics
 * - DIP: Depends on IMetricsCollector abstraction
 */
export class CacheStatisticsTracker {
  private readonly stats: {
    hits: number;
    misses: number;
    sets: number;
  };
  private readonly metricsCollector: MetricsCollector | null;

  constructor({ metricsCollector = null }: { metricsCollector?: MetricsCollector | null } = {}) {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
    this.metricsCollector = metricsCollector;
  }

  recordHit(cacheType: string = 'default'): void {
    this.stats.hits++;
    this.metricsCollector?.recordCacheHit?.(cacheType);
    this._updateHitRate(cacheType);
  }

  recordMiss(cacheType: string = 'default'): void {
    this.stats.misses++;
    this.metricsCollector?.recordCacheMiss?.(cacheType);
    this._updateHitRate(cacheType);
  }

  recordSet(): void {
    this.stats.sets++;
  }

  getStatistics(): CacheStatistics {
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

  private _updateHitRate(cacheType: string): void {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    this.metricsCollector?.updateCacheHitRate?.(cacheType, hitRate);
  }
}

