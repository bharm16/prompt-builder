/**
 * BACKWARD COMPATIBILITY SHIM
 *
 * This contract duplicated @interfaces/ICacheService.
 * It now tracks the canonical CacheOptions type and keeps legacy hooks.
 */

import type { CacheOptions } from '@interfaces/ICacheService.js';
import type { CacheStats } from '../types/services.ts';

export type { CacheOptions };

/**
 * @deprecated Prefer @interfaces/ICacheService.
 */
export interface ICacheService {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache (legacy ttl signature)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<boolean | void>;

  /**
   * Set a value in cache (canonical options signature)
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean | void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<number | void>;

  /**
   * Generate cache key from namespace and data (optional legacy hook)
   */
  generateKey?(namespace: string, data: Record<string, unknown>): string;

  /**
   * Clear all cache entries (optional legacy hook)
   */
  clear?(): Promise<void>;

  /**
   * Get cache statistics (optional legacy hook)
   */
  getStats?(): Promise<CacheStats>;
}
