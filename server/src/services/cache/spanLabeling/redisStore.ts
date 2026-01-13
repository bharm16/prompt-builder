import type { RedisClient } from '../types';

export function isRedisReady(redis: RedisClient | null): boolean {
  return !!redis && redis.status === 'ready';
}

export async function getRedisValue(
  redis: RedisClient | null,
  key: string
): Promise<string | null> {
  if (!isRedisReady(redis) || !redis?.get) {
    return null;
  }

  return await redis.get(key);
}

export async function setRedisValue(
  redis: RedisClient | null,
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  if (!isRedisReady(redis) || !redis?.set) {
    return;
  }

  await redis.set(key, value, 'EX', ttlSeconds);
}

export async function deleteRedisKey(
  redis: RedisClient | null,
  key: string
): Promise<number> {
  if (!isRedisReady(redis) || !redis?.del) {
    return 0;
  }

  return await redis.del(key);
}

export async function deleteRedisPattern(
  redis: RedisClient | null,
  pattern: string
): Promise<number> {
  if (!isRedisReady(redis) || !redis?.keys || !redis?.del) {
    return 0;
  }

  const keys = await redis.keys(pattern);
  if (keys.length === 0) {
    return 0;
  }

  return await redis.del(...keys);
}
