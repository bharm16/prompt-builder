import { logger } from '@infrastructure/Logger';
import type { ICacheService, CacheOptions } from '@interfaces/ICacheService.js';
import type { CacheServiceWithStatisticsOptions, CacheStatisticsTracker } from './types.js';

/**
 * Cache Service with Statistics (Decorator Pattern)
 * 
 * SOLID Principles Applied:
 * - SRP: Adds statistics tracking to any cache implementation
 * - OCP: Extends cache behavior without modifying it
 * - DIP: Depends on ICacheService abstraction
 */
export class CacheServiceWithStatistics implements ICacheService {
  private readonly log = logger.child({ service: 'CacheServiceWithStatistics' });
  private readonly cacheService: ICacheService;
  private readonly statisticsTracker: CacheStatisticsTracker;

  constructor({ cacheService, statisticsTracker }: CacheServiceWithStatisticsOptions) {
    this.cacheService = cacheService;
    this.statisticsTracker = statisticsTracker;
  }

  async get<T>(key: string, cacheType: string = 'default'): Promise<T | null> {
    const operation = 'get';
    
    this.log.debug('Cache get operation', {
      operation,
      key,
      cacheType,
    });

    const value = await this.cacheService.get<T>(key);
    
    if (value !== null) {
      this.statisticsTracker.recordHit(cacheType);
      this.log.debug('Cache hit', {
        operation,
        key,
        cacheType,
      });
    } else {
      this.statisticsTracker.recordMiss(cacheType);
      this.log.debug('Cache miss', {
        operation,
        key,
        cacheType,
      });
    }
    
    return value;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const operation = 'set';
    
    this.log.debug('Cache set operation', {
      operation,
      key,
      ttl: options.ttl || null,
    });

    const success = await this.cacheService.set(key, value, options);
    
    if (success) {
      this.statisticsTracker.recordSet();
      this.log.debug('Cache set successful', {
        operation,
        key,
      });
    } else {
      this.log.debug('Cache set failed', {
        operation,
        key,
      });
    }
    
    return success;
  }

  async delete(key: string): Promise<number> {
    const operation = 'delete';
    
    this.log.debug('Cache delete operation', {
      operation,
      key,
    });

    const deletedCount = await this.cacheService.delete(key);
    
    this.log.debug('Cache delete completed', {
      operation,
      key,
      deletedCount,
    });

    return deletedCount;
  }

  async flush(): Promise<void> {
    if (typeof (this.cacheService as { flush?: () => Promise<void> }).flush === 'function') {
      return (this.cacheService as { flush: () => Promise<void> }).flush();
    }
  }

  generateKey(namespace: string, data: Record<string, unknown>): string {
    return this.cacheService.generateKey(namespace, data);
  }

  getStatistics() {
    const stats = this.statisticsTracker.getStatistics();
    
    this.log.debug('Cache statistics retrieved', {
      operation: 'getStatistics',
      hitRate: stats.hitRate,
      hits: stats.hits,
      misses: stats.misses,
      sets: stats.sets,
    });
    
    return stats;
  }

  isHealthy(): boolean {
    if (typeof (this.cacheService as { isHealthy?: () => boolean }).isHealthy === 'function') {
      return (this.cacheService as { isHealthy: () => boolean }).isHealthy();
    }
    return true;
  }
}

