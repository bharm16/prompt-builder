import { logger } from '@infrastructure/Logger';
import type { ICacheService, CacheOptions } from '@interfaces/ICacheService';
import type { CacheServiceWithStatisticsOptions, CacheStatisticsTracker } from './types';

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
    const startTime = performance.now();
    const operation = 'get';
    
    this.log.debug('Cache get operation', {
      operation,
      key,
      cacheType,
    });

    const value = await this.cacheService.get<T>(key);
    const duration = Math.round(performance.now() - startTime);
    
    if (value !== null) {
      this.statisticsTracker.recordHit(cacheType);
      this.log.debug('Cache hit', {
        operation,
        duration,
        key,
        cacheType,
      });
    } else {
      this.statisticsTracker.recordMiss(cacheType);
      this.log.debug('Cache miss', {
        operation,
        duration,
        key,
        cacheType,
      });
    }
    
    return value;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const startTime = performance.now();
    const operation = 'set';
    
    this.log.debug('Cache set operation', {
      operation,
      key,
      ttl: options.ttl || null,
    });

    const success = await this.cacheService.set(key, value, options);
    const duration = Math.round(performance.now() - startTime);
    
    if (success) {
      this.statisticsTracker.recordSet();
      this.log.debug('Cache set successful', {
        operation,
        duration,
        key,
      });
    } else {
      this.log.debug('Cache set failed', {
        operation,
        duration,
        key,
      });
    }
    
    return success;
  }

  async delete(key: string): Promise<number> {
    const startTime = performance.now();
    const operation = 'delete';
    
    this.log.debug('Cache delete operation', {
      operation,
      key,
    });

    const deletedCount = await this.cacheService.delete(key);
    const duration = Math.round(performance.now() - startTime);
    
    this.log.debug('Cache delete completed', {
      operation,
      duration,
      key,
      deletedCount,
    });

    return deletedCount;
  }

  async flush(): Promise<void> {
    const cacheWithFlush = this.cacheService as unknown as { flush?: () => Promise<void> };
    if (typeof cacheWithFlush.flush === 'function') {
      return cacheWithFlush.flush();
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
    const cacheWithHealth = this.cacheService as unknown as { isHealthy?: () => boolean };
    if (typeof cacheWithHealth.isHealthy === 'function') {
      return cacheWithHealth.isHealthy();
    }
    return true;
  }
}
