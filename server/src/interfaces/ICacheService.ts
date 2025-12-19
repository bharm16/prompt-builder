/**
 * Cache Service Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal interface for cache operations
 * - DIP: Abstraction that services depend on
 */

export interface CacheOptions {
  ttl?: number;
  [key: string]: unknown;
}

export interface ICacheService {
  /**
   * Get value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;

  /**
   * Delete value from cache
   */
  delete(key: string): Promise<number>;

  /**
   * Generate cache key from namespace and data
   */
  generateKey(namespace: string, data: Record<string, unknown>): string;
}

