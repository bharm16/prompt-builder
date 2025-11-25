import NodeCache from 'node-cache';
import crypto from 'crypto';
import { logger } from '../../infrastructure/Logger.ts';
import { metricsService } from '../../infrastructure/MetricsService.js';
import { SemanticCacheEnhancer } from './SemanticCacheService.js';

/**
 * LEGACY CACHE SERVICE
 * 
 * ⚠️ This is a singleton-based cache service used by legacy services.
 * 
 * STATUS: Currently in use by 6 services
 * FUTURE: Should eventually be replaced with dependency-injected pattern
 *         using CacheServiceWithStatistics from this directory
 * 
 * New code should use: services/cache/CacheServiceWithStatistics.js
 * with proper dependency injection via services.config.js
 */

interface CacheConfig {
  defaultTTL?: number;
  promptOptimization?: { ttl: number; namespace: string };
  questionGeneration?: { ttl: number; namespace: string };
  enhancement?: { ttl: number; namespace: string };
  sceneDetection?: { ttl: number; namespace: string };
  creative?: { ttl: number; namespace: string };
  [key: string]: unknown;
}

interface CacheOptions {
  ttl?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  hitRate: string;
  keys: number;
  size: NodeCache.Stats;
}

interface GenerateKeyOptions {
  useSemantic?: boolean;
  normalizeWhitespace?: boolean;
  ignoreCase?: boolean;
  sortKeys?: boolean;
}

interface HealthCheckResult {
  healthy: boolean;
  stats?: CacheStats;
  error?: string;
}

/**
 * Cache service for storing API responses
 * Reduces external API calls and improves response times
 */
export class CacheService {
  private readonly cache: NodeCache;
  private readonly stats: {
    hits: number;
    misses: number;
    sets: number;
  };
  private readonly config: CacheConfig;

  constructor(config: CacheConfig = {}) {
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
    this.cache.on('expired', (key: string) => {
      logger.debug('Cache key expired', { key });
    });

    logger.info('Cache service initialized', {
      defaultTTL: config.defaultTTL || 3600,
    });
  }

  /**
   * Generate cache key from data
   * @param namespace - Cache namespace
   * @param data - Data to hash
   * @param options - Options for semantic caching
   * @returns Cache key
   */
  generateKey(namespace: string, data: unknown, options: GenerateKeyOptions = {}): string {
    const { useSemantic = true, normalizeWhitespace = true, ignoreCase = true, sortKeys = true } = options;

    // Use semantic caching by default for better hit rates
    if (useSemantic) {
      return SemanticCacheEnhancer.generateSemanticKey(namespace, data as Record<string, unknown>, {
        normalizeWhitespace,
        ignoreCase,
        sortKeys,
      });
    }

    // Fallback to standard hashing
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);

    return `${namespace}:${hash}`;
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @param cacheType - Type of cache for metrics
   * @returns Cached value or null
   */
  async get<T = unknown>(key: string, cacheType: string = 'default'): Promise<T | null> {
    const value = this.cache.get<T>(key);

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
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options
   * @returns Success status
   */
  async set<T = unknown>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const ttl = options.ttl || this.cache.options.stdTTL || 3600;
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
   * @param key - Cache key
   * @returns Number of deleted keys
   */
  async delete(key: string): Promise<number> {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      logger.debug('Cache key deleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
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
  private updateHitRate(cacheType: string): void {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    metricsService.updateCacheHitRate(cacheType, hitRate);
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): HealthCheckResult {
    try {
      const testKey = 'health-check';
      this.cache.set(testKey, 'ok', 1);
      const value = this.cache.get<string>(testKey);
      this.cache.del(testKey);

      return {
        healthy: value === 'ok',
        stats: this.getCacheStats(),
      };
    } catch (error: unknown) {
      logger.error('Cache health check failed', error instanceof Error ? error : undefined, {});
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get cache configuration for a specific type
   */
  getConfig(type: string): { ttl: number; namespace: string } {
    const config = this.config[type] as { ttl: number; namespace: string } | undefined;
    return config || { ttl: this.cache.options.stdTTL || 3600, namespace: 'default' };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
