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
  private readonly cacheService: ICacheService;
  private readonly statisticsTracker: CacheStatisticsTracker;

  constructor({ cacheService, statisticsTracker }: CacheServiceWithStatisticsOptions) {
    this.cacheService = cacheService;
    this.statisticsTracker = statisticsTracker;
  }

  async get<T>(key: string, cacheType: string = 'default'): Promise<T | null> {
    const value = await this.cacheService.get<T>(key);
    
    if (value !== null) {
      this.statisticsTracker.recordHit(cacheType);
    } else {
      this.statisticsTracker.recordMiss(cacheType);
    }
    
    return value;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const success = await this.cacheService.set(key, value, options);
    
    if (success) {
      this.statisticsTracker.recordSet();
    }
    
    return success;
  }

  async delete(key: string): Promise<number> {
    return this.cacheService.delete(key);
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
    return this.statisticsTracker.getStatistics();
  }

  isHealthy(): boolean {
    if (typeof (this.cacheService as { isHealthy?: () => boolean }).isHealthy === 'function') {
      return (this.cacheService as { isHealthy: () => boolean }).isHealthy();
    }
    return true;
  }
}

