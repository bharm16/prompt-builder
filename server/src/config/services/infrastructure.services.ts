import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { metricsService } from '@infrastructure/MetricsService';
import { cacheService } from '@services/cache/CacheService';
import { initSpanLabelingCache } from '@services/cache/SpanLabelingCacheService';
import type { RedisClient } from '@services/cache/types';
import { userCreditService } from '@services/credits/UserCreditService';
import { FaceEmbeddingService } from '@services/asset/FaceEmbeddingService';
import { getStorageService } from '@services/storage/StorageService';
import { createVideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { createVideoAssetStore } from '@services/video-generation/storage';
import { createVideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import { createRedisClient } from '../redis.ts';
import type { ServiceConfig } from './service-config.types.ts';

export function registerInfrastructureServices(container: DIContainer): void {
  container.registerValue('logger', logger);
  container.registerValue('metricsService', metricsService);
  container.registerValue('cacheService', cacheService);
  container.registerValue('userCreditService', userCreditService);

  container.register('storageService', () => getStorageService(), [], { singleton: true });

  container.register(
    'faceEmbeddingService',
    () => {
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        logger.warn('FaceEmbeddingService disabled: REPLICATE_API_TOKEN not set');
        return null;
      }
      return new FaceEmbeddingService(undefined, token);
    },
    [],
    { singleton: true }
  );

  container.register('videoAssetStore', () => createVideoAssetStore(), [], { singleton: true });
  container.register('videoJobStore', () => new VideoJobStore(), [], { singleton: true });
  container.register('videoContentAccessService', () => createVideoContentAccessService(), [], { singleton: true });

  container.register(
    'videoAssetRetentionService',
    (videoAssetStore: ReturnType<typeof createVideoAssetStore>) =>
      createVideoAssetRetentionService(videoAssetStore),
    ['videoAssetStore'],
    { singleton: true }
  );

  container.registerValue('config', {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      timeout: parseInt(process.env.OPENAI_TIMEOUT_MS || '60000', 10),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      timeout: parseInt(process.env.GROQ_TIMEOUT_MS || '5000', 10),
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    },
    qwen: {
      apiKey: process.env.GROQ_API_KEY,
      timeout: parseInt(process.env.QWEN_TIMEOUT_MS || '10000', 10),
      model: process.env.QWEN_MODEL || 'qwen/qwen3-32b',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      timeout: parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    },
    redis: {
      defaultTTL: 3600,
      shortTTL: 300,
      maxMemoryCacheSize: 100,
    },
    server: {
      port: process.env.PORT || 3001,
      environment: process.env.NODE_ENV || 'development',
    },
  } as ServiceConfig);

  container.register('redisClient', () => createRedisClient(), []);

  container.register(
    'spanLabelingCacheService',
    (redisClient: ReturnType<typeof createRedisClient>, config: ServiceConfig) => initSpanLabelingCache({
      redis: redisClient as RedisClient | null,
      defaultTTL: config.redis.defaultTTL,
      shortTTL: config.redis.shortTTL,
      maxMemoryCacheSize: config.redis.maxMemoryCacheSize,
    }),
    ['redisClient', 'config']
  );
}
