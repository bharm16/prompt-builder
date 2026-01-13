import type { MemoryCacheEntry } from '../types';

export class MemoryLruCache {
  private readonly cache = new Map<string, MemoryCacheEntry>();

  constructor(private readonly maxSize: number) {}

  get(key: string): MemoryCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry;
  }

  set(key: string, data: unknown, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data, expiresAt });

    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  cleanupExpired(): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
    return toDelete.length;
  }
}
