import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isRedisReady,
  getRedisValue,
  setRedisValue,
  deleteRedisKey,
  deleteRedisPattern,
} from '../redisStore';

function createMockRedis(status: string = 'ready') {
  return {
    status,
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  };
}

describe('isRedisReady', () => {
  describe('error handling', () => {
    it('returns false for null redis', () => {
      expect(isRedisReady(null)).toBe(false);
    });

    it('returns false for undefined redis', () => {
      expect(isRedisReady(undefined as never)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false when status is not ready', () => {
      const redis = createMockRedis('connecting');
      expect(isRedisReady(redis)).toBe(false);
    });

    it('returns false when status is disconnected', () => {
      const redis = createMockRedis('disconnected');
      expect(isRedisReady(redis)).toBe(false);
    });

    it('returns false when status is empty string', () => {
      const redis = createMockRedis('');
      expect(isRedisReady(redis)).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('returns true when status is ready', () => {
      const redis = createMockRedis('ready');
      expect(isRedisReady(redis)).toBe(true);
    });
  });
});

describe('getRedisValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns null when redis is null', async () => {
      const result = await getRedisValue(null, 'key');
      expect(result).toBeNull();
    });

    it('returns null when redis is not ready', async () => {
      const redis = createMockRedis('connecting');
      redis.get.mockResolvedValue('value');

      const result = await getRedisValue(redis, 'key');

      expect(result).toBeNull();
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('returns null when get method is undefined', async () => {
      const redis = { status: 'ready' } as never;

      const result = await getRedisValue(redis, 'key');

      expect(result).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns value from redis when ready', async () => {
      const redis = createMockRedis('ready');
      redis.get.mockResolvedValue('stored-value');

      const result = await getRedisValue(redis, 'my-key');

      expect(result).toBe('stored-value');
      expect(redis.get).toHaveBeenCalledWith('my-key');
    });

    it('returns null when key not found', async () => {
      const redis = createMockRedis('ready');
      redis.get.mockResolvedValue(null);

      const result = await getRedisValue(redis, 'nonexistent');

      expect(result).toBeNull();
    });
  });
});

describe('setRedisValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('does nothing when redis is null', async () => {
      await expect(setRedisValue(null, 'key', 'value', 60)).resolves.toBeUndefined();
    });

    it('does nothing when redis is not ready', async () => {
      const redis = createMockRedis('connecting');

      await setRedisValue(redis, 'key', 'value', 60);

      expect(redis.set).not.toHaveBeenCalled();
    });

    it('does nothing when set method is undefined', async () => {
      const redis = { status: 'ready' } as never;

      await expect(setRedisValue(redis, 'key', 'value', 60)).resolves.toBeUndefined();
    });
  });

  describe('core behavior', () => {
    it('sets value with TTL when redis is ready', async () => {
      const redis = createMockRedis('ready');

      await setRedisValue(redis, 'my-key', 'my-value', 120);

      expect(redis.set).toHaveBeenCalledWith('my-key', 'my-value', 'EX', 120);
    });

    it('uses correct TTL in seconds', async () => {
      const redis = createMockRedis('ready');

      await setRedisValue(redis, 'key', 'value', 3600);

      expect(redis.set).toHaveBeenCalledWith('key', 'value', 'EX', 3600);
    });
  });

  describe('edge cases', () => {
    it('handles zero TTL', async () => {
      const redis = createMockRedis('ready');

      await setRedisValue(redis, 'key', 'value', 0);

      expect(redis.set).toHaveBeenCalledWith('key', 'value', 'EX', 0);
    });

    it('handles empty value', async () => {
      const redis = createMockRedis('ready');

      await setRedisValue(redis, 'key', '', 60);

      expect(redis.set).toHaveBeenCalledWith('key', '', 'EX', 60);
    });
  });
});

describe('deleteRedisKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns 0 when redis is null', async () => {
      const result = await deleteRedisKey(null, 'key');
      expect(result).toBe(0);
    });

    it('returns 0 when redis is not ready', async () => {
      const redis = createMockRedis('connecting');

      const result = await deleteRedisKey(redis, 'key');

      expect(result).toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('returns 0 when del method is undefined', async () => {
      const redis = { status: 'ready' } as never;

      const result = await deleteRedisKey(redis, 'key');

      expect(result).toBe(0);
    });
  });

  describe('core behavior', () => {
    it('deletes key and returns count', async () => {
      const redis = createMockRedis('ready');
      redis.del.mockResolvedValue(1);

      const result = await deleteRedisKey(redis, 'my-key');

      expect(result).toBe(1);
      expect(redis.del).toHaveBeenCalledWith('my-key');
    });

    it('returns 0 when key does not exist', async () => {
      const redis = createMockRedis('ready');
      redis.del.mockResolvedValue(0);

      const result = await deleteRedisKey(redis, 'nonexistent');

      expect(result).toBe(0);
    });
  });
});

describe('deleteRedisPattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns 0 when redis is null', async () => {
      const result = await deleteRedisPattern(null, 'pattern:*');
      expect(result).toBe(0);
    });

    it('returns 0 when redis is not ready', async () => {
      const redis = createMockRedis('connecting');

      const result = await deleteRedisPattern(redis, 'pattern:*');

      expect(result).toBe(0);
      expect(redis.keys).not.toHaveBeenCalled();
    });

    it('returns 0 when keys method is undefined', async () => {
      const redis = { status: 'ready', del: vi.fn() } as never;

      const result = await deleteRedisPattern(redis, 'pattern:*');

      expect(result).toBe(0);
    });

    it('returns 0 when del method is undefined', async () => {
      const redis = { status: 'ready', keys: vi.fn() } as never;

      const result = await deleteRedisPattern(redis, 'pattern:*');

      expect(result).toBe(0);
    });
  });

  describe('core behavior', () => {
    it('deletes all matching keys', async () => {
      const redis = createMockRedis('ready');
      redis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      redis.del.mockResolvedValue(3);

      const result = await deleteRedisPattern(redis, 'span:*');

      expect(result).toBe(3);
      expect(redis.keys).toHaveBeenCalledWith('span:*');
      expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('returns 0 when no keys match pattern', async () => {
      const redis = createMockRedis('ready');
      redis.keys.mockResolvedValue([]);

      const result = await deleteRedisPattern(redis, 'nonexistent:*');

      expect(result).toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles single matching key', async () => {
      const redis = createMockRedis('ready');
      redis.keys.mockResolvedValue(['single-key']);
      redis.del.mockResolvedValue(1);

      const result = await deleteRedisPattern(redis, 'single:*');

      expect(result).toBe(1);
      expect(redis.del).toHaveBeenCalledWith('single-key');
    });

    it('handles many matching keys', async () => {
      const redis = createMockRedis('ready');
      const manyKeys = Array.from({ length: 100 }, (_, i) => `key${i}`);
      redis.keys.mockResolvedValue(manyKeys);
      redis.del.mockResolvedValue(100);

      const result = await deleteRedisPattern(redis, 'key*');

      expect(result).toBe(100);
      expect(redis.del).toHaveBeenCalledWith(...manyKeys);
    });
  });
});
