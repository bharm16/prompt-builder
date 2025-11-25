import { ICacheService } from '@interfaces/ICacheService';

/**
 * Cache Service with Statistics (Decorator Pattern)
 * 
 * SOLID Principles Applied:
 * - SRP: Adds statistics tracking to any cache implementation
 * - OCP: Extends cache behavior without modifying it
 * - DIP: Depends on ICacheService abstraction
 */
export class CacheServiceWithStatistics extends ICacheService {
  constructor({ cacheService, statisticsTracker }) {
    super();
    this.cacheService = cacheService;
    this.statisticsTracker = statisticsTracker;
  }

  async get(key, cacheType = 'default') {
    const value = await this.cacheService.get(key);
    
    if (value !== null) {
      this.statisticsTracker.recordHit(cacheType);
    } else {
      this.statisticsTracker.recordMiss(cacheType);
    }
    
    return value;
  }

  async set(key, value, options = {}) {
    const success = await this.cacheService.set(key, value, options);
    
    if (success) {
      this.statisticsTracker.recordSet();
    }
    
    return success;
  }

  async delete(key) {
    return this.cacheService.delete(key);
  }

  async flush() {
    if (typeof this.cacheService.flush === 'function') {
      return this.cacheService.flush();
    }
  }

  generateKey(namespace, data) {
    return this.cacheService.generateKey(namespace, data);
  }

  getStatistics() {
    return this.statisticsTracker.getStatistics();
  }

  isHealthy() {
    if (typeof this.cacheService.isHealthy === 'function') {
      return this.cacheService.isHealthy();
    }
    return true;
  }
}
