import { createHash } from 'crypto';
import { logger } from '@infrastructure/Logger';
import { metricsService } from '@infrastructure/MetricsService';
import type {
  SpanLabelingCacheServiceOptions,
  RedisClient,
  MemoryCacheEntry,
  SpanLabelingCacheStats,
  SpanLabelingPolicy
} from './types';

// Bump this to invalidate old cached span results when the NLP/LLM pipeline changes.
// v4: Fixed role → category transformation for Gemini provider (2024-12-28)
const SPAN_LABELING_CACHE_KEY_VERSION = '4';

/**
 * SpanLabelingCacheService - Server-side caching for span labeling results
 *
 * Implements a cache-aside pattern with Redis (or in-memory fallback) to reduce
 * OpenAI API calls by 70-90%. Provides fast (<5ms) retrieval for cached results.
 *
 * Features:
 * - Redis-backed persistence with automatic fallback to in-memory
 * - TTL-based expiration (1 hour for exact matches, 5 min for similar texts)
 * - Cache key based on text hash + policy + template version
 * - Metrics tracking for cache hit/miss rates
 * - LRU eviction for in-memory cache
 *
 * @example
 * const cacheService = new SpanLabelingCacheService({ redis: redisClient });
 * const cached = await cacheService.get(text, policy, templateVersion);
 * if (!cached) {
 *   const result = await openAI.labelSpans(text);
 *   await cacheService.set(text, policy, templateVersion, result);
 * }
 */
export class SpanLabelingCacheService {
  private readonly redis: RedisClient | null;
  private readonly defaultTTL: number;
  private readonly shortTTL: number;
  private readonly maxMemoryCacheSize: number;
  private readonly memoryCache: Map<string, MemoryCacheEntry>;
  private readonly stats: {
    hits: number;
    misses: number;
    sets: number;
    errors: number;
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: SpanLabelingCacheServiceOptions = {}) {
    this.redis = options.redis || null;
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour
    this.shortTTL = options.shortTTL || 300; // 5 minutes
    this.maxMemoryCacheSize = options.maxMemoryCacheSize || 100;

    // In-memory fallback cache (LRU)
    this.memoryCache = new Map();

    // Metrics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
    };

    logger.info('SpanLabelingCacheService initialized', {
      redisEnabled: !!this.redis,
      defaultTTL: this.defaultTTL,
      shortTTL: this.shortTTL,
      maxMemoryCacheSize: this.maxMemoryCacheSize,
    });
  }

  /**
   * Generate cache key from text, policy, and template version
   */
  private _generateCacheKey(
    text: string,
    policy: SpanLabelingPolicy | null,
    templateVersion: string | null,
    provider: string | null = null
  ): string {
    // Create a deterministic hash of the text
    const textHash = createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16);

    // Create a deterministic hash of policy + templateVersion
    const policyString = JSON.stringify({
      v: SPAN_LABELING_CACHE_KEY_VERSION,
      policy: policy || {},
      templateVersion: templateVersion || 'v1',
      provider: provider || 'unknown',
    });

    const policyHash = createHash('sha256')
      .update(policyString)
      .digest('hex')
      .substring(0, 8);

    return `span:${textHash}:${policyHash}`;
  }

  /**
   * Get cached span labeling result
   */
  async get(
    text: string,
    policy: SpanLabelingPolicy | null,
    templateVersion: string | null,
    provider: string | null = null
  ): Promise<unknown | null> {
    const startTime = Date.now();
    const cacheKey = this._generateCacheKey(text, policy, templateVersion, provider);

    try {
      // Try Redis first
      if (this.redis && this.redis.status === 'ready' && this.redis.get) {
        const cached = await this.redis.get(cacheKey);

        if (cached) {
          const result = JSON.parse(cached);
          this.stats.hits++;

          const duration = Date.now() - startTime;
          logger.debug('Cache hit (Redis)', {
            cacheKey,
            duration,
            textLength: text.length,
          });

          metricsService.recordCacheHit('span_labeling_redis');
          metricsService.recordHistogram('cache_retrieval_time_ms', duration);

          return result;
        }
      }

      // Try in-memory cache
      if (this.memoryCache.has(cacheKey)) {
        const cacheEntry = this.memoryCache.get(cacheKey)!;

        // Check if entry is expired
        if (Date.now() < cacheEntry.expiresAt) {
          // Move to end (LRU)
          this.memoryCache.delete(cacheKey);
          this.memoryCache.set(cacheKey, cacheEntry);

          this.stats.hits++;

          const duration = Date.now() - startTime;
          logger.debug('Cache hit (memory)', {
            cacheKey,
            duration,
            textLength: text.length,
          });

          metricsService.recordCacheHit('span_labeling_memory');
          metricsService.recordHistogram('cache_retrieval_time_ms', duration);

          return cacheEntry.data;
        } else {
          // Expired, remove from cache
          this.memoryCache.delete(cacheKey);
        }
      }

      // Cache miss
      this.stats.misses++;
      metricsService.recordCacheMiss('span_labeling');

      const duration = Date.now() - startTime;
      logger.debug('Cache miss', {
        cacheKey,
        duration,
        textLength: text.length,
      });

      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', error as Error, { cacheKey });
      return null;
    }
  }

  /**
   * Set cached span labeling result
   */
  async set(
    text: string,
    policy: SpanLabelingPolicy | null,
    templateVersion: string | null,
    result: unknown,
    options: { ttl?: number; provider?: string | null } = {}
  ): Promise<boolean> {
    const cacheKey = this._generateCacheKey(
      text,
      policy,
      templateVersion,
      options.provider ?? null
    );
    const ttl = options.ttl || this.defaultTTL;

    try {
      const serialized = JSON.stringify(result);

      // Set in Redis
      if (this.redis && this.redis.status === 'ready' && this.redis.set) {
        await this.redis.set(cacheKey, serialized, 'EX', ttl);

        logger.debug('Cache set (Redis)', {
          cacheKey,
          ttl,
          textLength: text.length,
        });
      }

      // Set in memory cache (with LRU eviction)
      const expiresAt = Date.now() + ttl * 1000;
      this.memoryCache.set(cacheKey, {
        data: result,
        expiresAt,
      });

      // LRU eviction: remove oldest entry if cache is full
      if (this.memoryCache.size > this.maxMemoryCacheSize) {
        const firstKey = this.memoryCache.keys().next().value;
        if (firstKey) {
          this.memoryCache.delete(firstKey);
        }
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', error as Error, { cacheKey });
      return false;
    }
  }

  /**
   * Invalidate cache for specific text
   */
  async invalidate(
    text: string,
    policy: SpanLabelingPolicy | null = null,
    templateVersion: string | null = null
  ): Promise<number> {
    if (policy && templateVersion) {
      // Invalidate specific cache entry
      const cacheKey = this._generateCacheKey(text, policy, templateVersion);

      try {
        // Delete from Redis
        let deletedCount = 0;
        if (this.redis && this.redis.status === 'ready' && this.redis.del) {
          deletedCount = await this.redis.del(cacheKey);
        }

        // Delete from memory cache
        if (this.memoryCache.has(cacheKey)) {
          this.memoryCache.delete(cacheKey);
          deletedCount++;
        }

        logger.debug('Cache invalidated', { cacheKey, deletedCount });
        return deletedCount;
      } catch (error) {
        logger.error('Cache invalidation error', error as Error, { cacheKey });
        return 0;
      }
    } else {
      // Invalidate all entries for this text (pattern matching)
      const textHash = createHash('sha256')
        .update(text)
        .digest('hex')
        .substring(0, 16);

      const pattern = `span:${textHash}:*`;

      try {
        let deletedCount = 0;

        // Delete from Redis
        if (this.redis && this.redis.status === 'ready' && this.redis.keys && this.redis.del) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            deletedCount = await this.redis.del(...keys);
          }
        }

        // Delete from memory cache
        for (const [key] of this.memoryCache.entries()) {
          if (key.startsWith(`span:${textHash}:`)) {
            this.memoryCache.delete(key);
            deletedCount++;
          }
        }

        logger.debug('Cache invalidated (pattern)', { pattern, deletedCount });
        return deletedCount;
      } catch (error) {
        logger.error('Cache invalidation error (pattern)', error as Error, { pattern });
        return 0;
      }
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    try {
      // Clear Redis
      if (this.redis && this.redis.status === 'ready' && this.redis.keys && this.redis.del) {
        const keys = await this.redis.keys('span:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear memory cache
      this.memoryCache.clear();

      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear error', error as Error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): SpanLabelingCacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      cacheSize: this.memoryCache.size,
      redisConnected: this.redis ? this.redis.status === 'ready' : false,
    };
  }

  /**
   * Clean up expired entries from memory cache
   */
  private _cleanupExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.memoryCache.delete(key));

    if (toDelete.length > 0) {
      logger.debug('Cleaned up expired cache entries', {
        count: toDelete.length,
      });
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  startPeriodicCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, intervalMs);

    logger.info('Started periodic cache cleanup', { intervalMs });
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped periodic cache cleanup');
    }
  }
}

// Singleton instance (will be initialized with Redis in server/index.js)
export let spanLabelingCache: SpanLabelingCacheService | null = null;

/**
 * Initialize the span labeling cache service
 */
export function initSpanLabelingCache(options: SpanLabelingCacheServiceOptions = {}): SpanLabelingCacheService {
  spanLabelingCache = new SpanLabelingCacheService(options);
  spanLabelingCache.startPeriodicCleanup();
  return spanLabelingCache;
}
