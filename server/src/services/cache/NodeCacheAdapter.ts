import NodeCache from 'node-cache';
import type { ICacheService, CacheOptions } from '@interfaces/ICacheService';
import type { CacheAdapterOptions, CacheKeyGenerator, Logger } from './types';

/**
 * NodeCache Adapter
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on cache operations
 * - LSP: Properly implements ICacheService contract
 * - DIP: Logger injected as dependency
 */
export class NodeCacheAdapter implements ICacheService {
  private readonly cache: NodeCache;
  private readonly keyGenerator: CacheKeyGenerator;
  private readonly logger: Logger | null;

  constructor({ config = {}, keyGenerator, logger = null }: CacheAdapterOptions) {
    this.cache = new NodeCache({
      stdTTL: config.defaultTTL || 3600,
      checkperiod: config.checkperiod || 600,
      useClones: false,
    });
    
    this.keyGenerator = keyGenerator;
    this.logger = logger;
    
    // Log cache events
    this.cache.on('expired', (key: string) => {
      this.logger?.debug?.('Cache key expired', { key });
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.cache.get<T>(key);
    
    if (value !== undefined) {
      this.logger?.debug?.('Cache hit', { key });
      return value;
    }
    
    this.logger?.debug?.('Cache miss', { key });
    return null;
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const ttl = options.ttl ?? this.cache.options.stdTTL ?? 0;
    const success = this.cache.set(key, value, ttl);
    
    if (success) {
      this.logger?.debug?.('Cache set', { key, ttl });
    } else {
      this.logger?.warn?.('Cache set failed', { key });
    }
    
    return success;
  }

  async delete(key: string): Promise<number> {
    const deleted = this.cache.del(key);
    if (deleted > 0) {
      this.logger?.debug?.('Cache key deleted', { key });
    }
    return deleted;
  }

  async flush(): Promise<void> {
    this.cache.flushAll();
    this.logger?.info?.('Cache flushed');
  }

  generateKey(namespace: string, data: Record<string, unknown>): string {
    return this.keyGenerator.generate(namespace, data);
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    try {
      const testKey = 'health-check';
      this.cache.set(testKey, 'ok', 1);
      const value = this.cache.get(testKey);
      this.cache.del(testKey);

      return value === 'ok';
    } catch (error) {
      this.logger?.error?.('Cache health check failed', error as Error);
      return false;
    }
  }
}
