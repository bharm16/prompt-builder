import Redis from 'ioredis';
import { logger } from '@infrastructure/Logger';

export type RedisStatus = 'connected' | 'disconnected' | 'reconnecting' | 'disabled';

let currentRedisStatus: RedisStatus = 'disabled';

/**
 * Create and configure Redis client
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection pooling
 * - Graceful fallback if Redis is unavailable
 * - Comprehensive error handling
 *
 * Environment variables:
 * - REDIS_URL: Redis connection URL (optional)
 * - REDIS_HOST: Redis host (default: localhost)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 * - REDIS_ENABLE_OFFLINE_QUEUE: Enable offline queue (default: false)
 *
 * @returns Redis client or null if disabled
 */
export function createRedisClient(): Redis | null {
  // Check if Redis is disabled via environment variable
  if (process.env.REDIS_DISABLED === 'true') {
    logger.info('Redis disabled via environment variable');
    return null;
  }

  try {
    const password = process.env.REDIS_PASSWORD;
    const redisConfig = {
      // Connection
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      ...(password && { password }),
      db: parseInt(process.env.REDIS_DB || '0', 10),

      // Connection pooling
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE === 'true',

      // Reconnection strategy
      retryStrategy(times: number): number {
        const delay = Math.min(times * 50, 2000);
        logger.debug('Redis reconnecting', { attempt: times, delay });
        return delay;
      },

      // Connection timeout
      connectTimeout: 10000, // 10 seconds

      // Keep-alive
      keepAlive: 30000, // 30 seconds

      // Lazy connect (don't block server startup if Redis is down)
      lazyConnect: true,
    };

    // Use REDIS_URL if provided (overrides individual settings)
    const redisUrl = process.env.REDIS_URL;
    const redis = redisUrl
      ? new Redis(redisUrl, redisConfig)
      : new Redis(redisConfig);

    // Event handlers with status tracking
    redis.on('connect', () => {
      logger.info('Redis connecting...');
    });

    redis.on('ready', () => {
      currentRedisStatus = 'connected';
      logger.info('Redis connected and ready', {
        host: redis.options.host,
        port: redis.options.port,
        db: redis.options.db,
      });
    });

    redis.on('error', (error: Error) => {
      // Don't crash the server if Redis fails
      logger.error('Redis error', error, {
        host: redis.options.host,
        port: redis.options.port,
      });
    });

    redis.on('close', () => {
      currentRedisStatus = 'disconnected';
      logger.warn('Redis connection closed — cache operations will use in-memory fallback');
    });

    redis.on('reconnecting', (delay: number) => {
      currentRedisStatus = 'reconnecting';
      logger.info('Redis reconnecting', { delay });
    });

    redis.on('end', () => {
      currentRedisStatus = 'disconnected';
      logger.warn('Redis connection ended');
    });

    // Attempt to connect (non-blocking)
    redis.connect().catch((error: Error) => {
      logger.error('Redis initial connection failed (will retry)', error);
    });

    return redis;
  } catch (error) {
    logger.error('Failed to create Redis client', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Gracefully close Redis connection
 */
export function getRedisStatus(): RedisStatus {
  return currentRedisStatus;
}

export async function closeRedisClient(redis: Redis | null): Promise<void> {
  if (!redis) return;

  try {
    logger.info('Closing Redis connection...');
    await redis.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection', error instanceof Error ? error : new Error(String(error)));
    // Force disconnect
    redis.disconnect();
  }
}

