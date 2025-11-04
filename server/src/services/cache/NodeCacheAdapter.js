import NodeCache from 'node-cache';
import { ICacheService } from '../../interfaces/ICacheService.js';

/**
 * NodeCache Adapter
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache operations
 * - LSP: Properly implements ICacheService contract
 * - DIP: Logger injected as dependency
 */
export class NodeCacheAdapter extends ICacheService {
  constructor({ config = {}, keyGenerator, logger = null }) {
    super();
    
    this.cache = new NodeCache({
      stdTTL: config.defaultTTL || 3600,
      checkperiod: config.checkperiod || 600,
      useClones: false,
    });
    
    this.keyGenerator = keyGenerator;
    this.logger = logger;
    
    // Log cache events
    this.cache.on('expired', (key) => {
      this.logger?.debug('Cache key expired', { key });
    });
  }

  async get(key) {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.logger?.debug('Cache hit', { key });
      return value;
    }
    
    this.logger?.debug('Cache miss', { key });
    return null;
  }

  async set(key, value, options = {}) {
    const ttl = options.ttl || this.cache.options.stdTTL;
    const success = this.cache.set(key, value, ttl);
    
    if (success) {
      this.logger?.debug('Cache set', { key, ttl });
    } else {
      this.logger?.warn('Cache set failed', { key });
    }
    
    return success;
  }

  async delete(key) {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      this.logger?.debug('Cache key deleted', { key });
    }
    return deleted;
  }

  async flush() {
    this.cache.flushAll();
    this.logger?.info('Cache flushed');
  }

  generateKey(namespace, data) {
    return this.keyGenerator.generate(namespace, data);
  }

  /**
   * Check if cache is healthy
   */
  isHealthy() {
    try {
      const testKey = 'health-check';
      this.cache.set(testKey, 'ok', 1);
      const value = this.cache.get(testKey);
      this.cache.del(testKey);

      return value === 'ok';
    } catch (error) {
      this.logger?.error('Cache health check failed', error);
      return false;
    }
  }
}
