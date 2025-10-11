import NodeCache from 'node-cache';
import crypto from 'crypto';
import { logger } from '../infrastructure/Logger.js';
import { metricsService } from '../infrastructure/MetricsService.js';

/**
 * Cache service for storing API responses
 * Reduces external API calls and improves response times
 */
export class CacheService {
  constructor(config = {}) {
    this.cache = new NodeCache({
      stdTTL: config.defaultTTL || 3600, // Default 1 hour
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Don't clone data (better performance)
    });

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };

    this.config = {
      promptOptimization: { ttl: 3600, namespace: 'prompt' },
      questionGeneration: { ttl: 1800, namespace: 'questions' },
      enhancement: { ttl: 3600, namespace: 'enhancement' },
      sceneDetection: { ttl: 3600, namespace: 'scene' },
      creative: { ttl: 7200, namespace: 'creative' },
      ...config,
    };

    // Log cache events
    this.cache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { key });
    });

    logger.info('Cache service initialized', {
      defaultTTL: config.defaultTTL || 3600,
    });
  }

  /**
   * Generate cache key from data
   * @param {string} namespace - Cache namespace
   * @param {Object} data - Data to hash
   * @returns {string} Cache key
   */
  generateKey(namespace, data) {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);

    return `${namespace}:${hash}`;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {string} cacheType - Type of cache for metrics
   * @returns {Promise<any>} Cached value or null
   */
  async get(key, cacheType = 'default') {
    const value = this.cache.get(key);

    if (value !== undefined) {
      this.stats.hits++;
      metricsService.recordCacheHit(cacheType);
      this.updateHitRate(cacheType);

      logger.debug('Cache hit', { key, cacheType });
      return value;
    }

    this.stats.misses++;
    metricsService.recordCacheMiss(cacheType);
    this.updateHitRate(cacheType);

    logger.debug('Cache miss', { key, cacheType });
    return null;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Object} options - Cache options
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, options = {}) {
    const ttl = options.ttl || this.cache.options.stdTTL;
    const success = this.cache.set(key, value, ttl);

    if (success) {
      this.stats.sets++;
      logger.debug('Cache set', { key, ttl });
    } else {
      logger.warn('Cache set failed', { key });
    }

    return success;
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {number} Number of deleted keys
   */
  async delete(key) {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      logger.debug('Cache key deleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  async flush() {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      keys: this.cache.keys().length,
      size: this.cache.getStats(),
    };
  }

  /**
   * Update hit rate metric
   * @private
   */
  updateHitRate(cacheType) {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    metricsService.updateCacheHitRate(cacheType, hitRate);
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

      return {
        healthy: value === 'ok',
        stats: this.getCacheStats(),
      };
    } catch (error) {
      logger.error('Cache health check failed', error);
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Get cache configuration for a specific type
   */
  getConfig(type) {
    return this.config[type] || { ttl: this.cache.options.stdTTL, namespace: 'default' };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
