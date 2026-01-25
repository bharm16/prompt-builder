/**
 * Types for cache services
 * Shared type definitions used across cache service modules
 */

import type { ICacheService } from '@interfaces/ICacheService';

/**
 * Cache configuration options
 */
export interface CacheConfig {
  defaultTTL?: number;
  checkperiod?: number;
  useClones?: boolean;
  [key: string]: unknown;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  hitRate: string;
}

/**
 * Cache key generation options
 */
export interface GenerateKeyOptions {
  useSemantic?: boolean;
  normalizeWhitespace?: boolean;
  ignoreCase?: boolean;
  sortKeys?: boolean;
}

/**
 * Semantic enhancer interface for cache key generation
 */
export interface SemanticEnhancer {
  generateSemanticKey?: (
    namespace: string,
    data: Record<string, unknown>,
    options?: GenerateKeyOptions
  ) => string;
}

/**
 * Metrics collector interface for cache statistics
 */
export interface MetricsCollector {
  recordCacheHit?: (cacheType: string) => void;
  recordCacheMiss?: (cacheType: string) => void;
  updateCacheHitRate?: (cacheType: string, hitRate: number) => void;
}

/**
 * Cache adapter constructor options
 */
export interface CacheAdapterOptions {
  config?: CacheConfig;
  keyGenerator: CacheKeyGenerator;
  logger?: Logger | null;
}

/**
 * Cache service with statistics constructor options
 */
export interface CacheServiceWithStatisticsOptions {
  cacheService: ICacheService;
  statisticsTracker: CacheStatisticsTracker;
}

/**
 * Cache key generator constructor options
 */
export interface CacheKeyGeneratorOptions {
  semanticEnhancer?: SemanticEnhancer | null;
}

/**
 * Logger interface (minimal)
 */
export interface Logger {
  debug?: (message: string, meta?: Record<string, unknown>) => void;
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, error?: Error) => void;
}

/**
 * Cache statistics tracker (forward declaration)
 */
export interface CacheStatisticsTracker {
  recordHit(cacheType?: string): void;
  recordMiss(cacheType?: string): void;
  recordSet(): void;
  getStatistics(): CacheStatistics;
}

/**
 * Cache key generator (forward declaration)
 */
export interface CacheKeyGenerator {
  generate(
    namespace: string,
    data: Record<string, unknown>,
    options?: GenerateKeyOptions
  ): string;
}

/**
 * Redis client interface (minimal)
 */
export interface RedisClient {
  status?: string;
  get?: (key: string) => Promise<string | null>;
  set?: (...args: [string, string | number, ...string[]]) => Promise<unknown>;
  del?: (...keys: string[]) => Promise<number>;
  keys?: (pattern: string) => Promise<string[]>;
}

/**
 * Span labeling cache service options
 */
export interface SpanLabelingCacheServiceOptions {
  redis?: RedisClient | null;
  defaultTTL?: number;
  shortTTL?: number;
  maxMemoryCacheSize?: number;
}

/**
 * Cache entry in memory cache
 */
export interface MemoryCacheEntry {
  data: unknown;
  expiresAt: number;
}

/**
 * Span labeling cache statistics
 */
export interface SpanLabelingCacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  hitRate: string;
  cacheSize: number;
  redisConnected: boolean;
}

/**
 * Span labeling policy (minimal type)
 */
export interface SpanLabelingPolicy {
  [key: string]: unknown;
}
