import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryLruCache } from '../memoryLru';

describe('MemoryLruCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('returns null for non-existent key', () => {
      const cache = new MemoryLruCache(10);

      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null and removes expired entry on get', () => {
      const cache = new MemoryLruCache(10);
      cache.set('key', 'value', 60); // 60 second TTL

      vi.advanceTimersByTime(61000); // Advance past expiry

      const result = cache.get('key');

      expect(result).toBeNull();
      expect(cache.size()).toBe(0);
    });

    it('handles delete on non-existent key', () => {
      const cache = new MemoryLruCache(10);

      const deleted = cache.delete('nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('evicts oldest entry when max size exceeded', () => {
      const cache = new MemoryLruCache(3);

      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);
      cache.set('key4', 'value4', 60); // Should evict key1

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')?.data).toBe('value2');
      expect(cache.get('key3')?.data).toBe('value3');
      expect(cache.get('key4')?.data).toBe('value4');
      expect(cache.size()).toBe(3);
    });

    it('moves accessed key to end (LRU behavior)', () => {
      const cache = new MemoryLruCache(3);

      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      // Access key1, moving it to most recently used
      cache.get('key1');

      // Add new key, should evict key2 (now oldest)
      cache.set('key4', 'value4', 60);

      expect(cache.get('key1')?.data).toBe('value1');
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')?.data).toBe('value3');
      expect(cache.get('key4')?.data).toBe('value4');
    });

    it('handles cache size of 1', () => {
      const cache = new MemoryLruCache(1);

      cache.set('key1', 'value1', 60);
      expect(cache.get('key1')?.data).toBe('value1');

      cache.set('key2', 'value2', 60);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')?.data).toBe('value2');
    });

    it('handles TTL of 0 seconds', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key', 'value', 0);
      vi.advanceTimersByTime(1);

      expect(cache.get('key')).toBeNull();
    });

    it('handles very large TTL', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key', 'value', Number.MAX_SAFE_INTEGER);

      expect(cache.get('key')?.data).toBe('value');
    });

    it('overwrites existing key', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key', 'value1', 60);
      cache.set('key', 'value2', 60);

      expect(cache.get('key')?.data).toBe('value2');
      expect(cache.size()).toBe(1);
    });

    it('stores complex objects as data', () => {
      const cache = new MemoryLruCache(10);
      const complexData = {
        spans: [{ text: 'test', category: 'action' }],
        metadata: { confidence: 0.95 },
      };

      cache.set('key', complexData, 60);

      expect(cache.get('key')?.data).toEqual(complexData);
    });
  });

  describe('TTL behavior', () => {
    it('returns entry before expiry', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key', 'value', 60);
      vi.advanceTimersByTime(59000);

      expect(cache.get('key')?.data).toBe('value');
    });

    it('expires entry exactly at TTL boundary', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key', 'value', 60);
      vi.advanceTimersByTime(60000);

      expect(cache.get('key')).toBeNull();
    });

    it('maintains independent TTL for each entry', () => {
      const cache = new MemoryLruCache(10);

      cache.set('short', 'short-value', 30);
      cache.set('long', 'long-value', 120);

      vi.advanceTimersByTime(50000);

      expect(cache.get('short')).toBeNull();
      expect(cache.get('long')?.data).toBe('long-value');
    });
  });

  describe('cleanupExpired', () => {
    it('removes all expired entries', () => {
      const cache = new MemoryLruCache(10);

      cache.set('expires1', 'value1', 30);
      cache.set('expires2', 'value2', 30);
      cache.set('stays', 'value3', 120);

      vi.advanceTimersByTime(50000);

      const removed = cache.cleanupExpired();

      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
      expect(cache.get('stays')?.data).toBe('value3');
    });

    it('returns 0 when no entries expired', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);

      const removed = cache.cleanupExpired();

      expect(removed).toBe(0);
      expect(cache.size()).toBe(2);
    });

    it('handles empty cache', () => {
      const cache = new MemoryLruCache(10);

      const removed = cache.cleanupExpired();

      expect(removed).toBe(0);
    });

    it('removes all entries when all expired', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key1', 'value1', 30);
      cache.set('key2', 'value2', 30);
      cache.set('key3', 'value3', 30);

      vi.advanceTimersByTime(50000);

      const removed = cache.cleanupExpired();

      expect(removed).toBe(3);
      expect(cache.size()).toBe(0);
    });
  });

  describe('core behavior', () => {
    it('get returns entry with data and expiresAt', () => {
      const cache = new MemoryLruCache(10);
      const now = Date.now();

      cache.set('key', 'value', 60);

      const entry = cache.get('key');

      expect(entry).not.toBeNull();
      expect(entry?.data).toBe('value');
      expect(entry?.expiresAt).toBe(now + 60000);
    });

    it('delete removes existing entry', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key', 'value', 60);
      const deleted = cache.delete('key');

      expect(deleted).toBe(true);
      expect(cache.get('key')).toBeNull();
    });

    it('clear removes all entries', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });

    it('size returns current entry count', () => {
      const cache = new MemoryLruCache(10);

      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1', 60);
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2', 60);
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });

    it('keys returns iterator of all keys', () => {
      const cache = new MemoryLruCache(10);

      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      const keys = Array.from(cache.keys());

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });
});
