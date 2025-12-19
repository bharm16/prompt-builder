import { logger } from '@infrastructure/Logger';
import type { CacheStatistics, MetricsCollector } from './types.js';

/**
 * Cache Statistics Tracker
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache statistics
 * - DIP: Depends on IMetricsCollector abstraction
 */
export class CacheStatisticsTracker {
  private readonly log = logger.child({ service: 'CacheStatisticsTracker' });
  private readonly stats: {
    hits: number;
    misses: number;
    sets: number;
  };
  private readonly metricsCollector: MetricsCollector | null;
  private lastLoggedHitRate: number = -1;

  constructor({ metricsCollector = null }: { metricsCollector?: MetricsCollector | null } = {}) {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
    this.metricsCollector = metricsCollector;
  }

  recordHit(cacheType: string = 'default'): void {
    const operation = 'recordHit';
    this.stats.hits++;
    
    this.log.debug('Cache hit recorded', {
      operation,
      cacheType,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
    });
    
    this.metricsCollector?.recordCacheHit?.(cacheType);
    this._updateHitRate(cacheType);
  }

  recordMiss(cacheType: string = 'default'): void {
    const operation = 'recordMiss';
    this.stats.misses++;
    
    this.log.debug('Cache miss recorded', {
      operation,
      cacheType,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
    });
    
    this.metricsCollector?.recordCacheMiss?.(cacheType);
    this._updateHitRate(cacheType);
  }

  recordSet(): void {
    const operation = 'recordSet';
    this.stats.sets++;
    
    this.log.debug('Cache set recorded', {
      operation,
      totalSets: this.stats.sets,
    });
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

    // Log significant hit rate changes (more than 5% difference)
    if (this.lastLoggedHitRate === -1 || Math.abs(hitRate - this.lastLoggedHitRate) >= 5) {
      this.log.info('Cache hit rate changed significantly', {
        operation: '_updateHitRate',
        cacheType,
        hitRate: hitRate.toFixed(2) + '%',
        previousHitRate: this.lastLoggedHitRate >= 0 ? this.lastLoggedHitRate.toFixed(2) + '%' : 'N/A',
        hits: this.stats.hits,
        misses: this.stats.misses,
      });
      this.lastLoggedHitRate = hitRate;
    }

    this.metricsCollector?.updateCacheHitRate?.(cacheType, hitRate);
  }
}

