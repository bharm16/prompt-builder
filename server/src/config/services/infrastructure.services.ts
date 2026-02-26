import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { MetricsService } from '@infrastructure/MetricsService';
import { Storage, type Bucket } from '@google-cloud/storage';
import { resolveBucketName } from '@config/storageBucket';
import { SIGNED_URL_TTL_MS } from '@config/signedUrlPolicy';
import { CacheService } from '@services/cache/CacheService';
import { initSpanLabelingCache } from '@services/cache/SpanLabelingCacheService';
import type { RedisClient } from '@services/cache/types';
import { UserCreditService } from '@services/credits/UserCreditService';
import { CreditReconciliationService } from '@services/credits/CreditReconciliationService';
import { createCreditReconciliationWorker } from '@services/credits/CreditReconciliationWorker';
import { createCreditRefundSweeper } from '@services/credits/CreditRefundSweeper';
import { RefundFailureStore, setRefundFailureStore } from '@services/credits/RefundFailureStore';
import { FirestoreCircuitExecutor, setFirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import { FaceEmbeddingService } from '@services/asset/FaceEmbeddingService';
import { StorageService } from '@services/storage/StorageService';
import { createImageAssetStore } from '@services/image-generation/storage';
import { createVideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { createVideoAssetStore, type VideoAssetStore } from '@services/video-generation/storage';
import { createVideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import { createGCSStorageService } from '@services/convergence/storage';
import { RequestIdempotencyService } from '@services/idempotency/RequestIdempotencyService';
import { resolveFalApiKey } from '@utils/falApiKey';
import { createRedisClient } from '../redis.ts';
import type { ServiceConfig } from './service-config.types.ts';

function resolveSignedUrlTtlMs(rawSeconds: string | undefined, fallbackMs: number): number {
  const ttlSeconds = Number.parseInt(rawSeconds || '', 10);
  return Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : fallbackMs;
}

export function registerInfrastructureServices(container: DIContainer): void {
  const resolvePositiveNumber = (
    raw: string | undefined,
    fallback: number,
    min = 0
  ): number => {
    const parsed = Number.parseFloat(raw || '');
    return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
  };

  container.registerValue('logger', logger);
  container.register('metricsService', () => new MetricsService(), [], { singleton: true });
  container.register(
    'firestoreCircuitExecutor',
    (metricsService: MetricsService) => {
      const executor = new FirestoreCircuitExecutor({
        timeoutMs: resolvePositiveNumber(process.env.FIRESTORE_CIRCUIT_TIMEOUT_MS, 3000, 1),
        errorThresholdPercentage: resolvePositiveNumber(
          process.env.FIRESTORE_CIRCUIT_ERROR_THRESHOLD_PERCENT,
          50,
          1
        ),
        resetTimeoutMs: resolvePositiveNumber(process.env.FIRESTORE_CIRCUIT_RESET_TIMEOUT_MS, 15000, 1),
        volumeThreshold: resolvePositiveNumber(process.env.FIRESTORE_CIRCUIT_MIN_VOLUME, 20, 1),
        maxRetries: resolvePositiveNumber(process.env.FIRESTORE_CIRCUIT_MAX_RETRIES, 2, 0),
        retryBaseDelayMs: resolvePositiveNumber(process.env.FIRESTORE_CIRCUIT_RETRY_BASE_DELAY_MS, 120, 1),
        retryJitterMs: resolvePositiveNumber(process.env.FIRESTORE_CIRCUIT_RETRY_JITTER_MS, 80, 0),
        readinessMaxFailureRate: resolvePositiveNumber(
          process.env.FIRESTORE_READINESS_MAX_FAILURE_RATE,
          0.5,
          0
        ),
        readinessMaxLatencyMs: resolvePositiveNumber(
          process.env.FIRESTORE_READINESS_MAX_LATENCY_MS,
          1500,
          1
        ),
        metricsCollector: metricsService,
      });
      setFirestoreCircuitExecutor(executor);
      return executor;
    },
    ['metricsService'],
    { singleton: true }
  );
  container.register(
    'cacheService',
    (metricsService: MetricsService) => new CacheService({}, metricsService),
    ['metricsService'],
    { singleton: true }
  );
  container.register(
    'userCreditService',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) => new UserCreditService(firestoreCircuitExecutor),
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );
  container.register(
    'creditReconciliationService',
    (
      userCreditService: UserCreditService,
      firestoreCircuitExecutor: FirestoreCircuitExecutor,
      metricsService: MetricsService
    ) =>
      new CreditReconciliationService(userCreditService, firestoreCircuitExecutor, {
        incrementalScanLimit: resolvePositiveNumber(
          process.env.CREDIT_RECONCILIATION_INCREMENTAL_SCAN_LIMIT,
          500,
          1
        ),
        fullPassPageSize: resolvePositiveNumber(
          process.env.CREDIT_RECONCILIATION_FULL_PAGE_SIZE,
          200,
          1
        ),
        metrics: metricsService,
      }),
    ['userCreditService', 'firestoreCircuitExecutor', 'metricsService'],
    { singleton: true }
  );
  container.register(
    'creditReconciliationWorker',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DI registration boundary is runtime-resolved
    (creditReconciliationService: any, metricsService: MetricsService) =>
      createCreditReconciliationWorker(creditReconciliationService, metricsService),
    ['creditReconciliationService', 'metricsService'],
    { singleton: true }
  );
  container.register(
    'refundFailureStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) => {
      const store = new RefundFailureStore(firestoreCircuitExecutor);
      setRefundFailureStore(store);
      return store;
    },
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );

  container.register(
    'creditRefundSweeper',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DI container values are untyped at registration boundary
    (refundFailureStore: any, creditService: UserCreditService, metricsService: MetricsService) =>
      createCreditRefundSweeper(refundFailureStore, creditService, metricsService),
    ['refundFailureStore', 'userCreditService', 'metricsService'],
    { singleton: true }
  );

  container.register('gcsStorage', () => new Storage(), [], { singleton: true });
  container.registerValue('gcsBucketName', resolveBucketName());
  container.register(
    'gcsBucket',
    (gcsStorage: Storage, gcsBucketName: string) => gcsStorage.bucket(gcsBucketName),
    ['gcsStorage', 'gcsBucketName'],
    { singleton: true }
  );

  container.register(
    'storageService',
    (gcsStorage: Storage, gcsBucketName: string) =>
      new StorageService({
        storage: gcsStorage,
        bucketName: gcsBucketName,
      }),
    ['gcsStorage', 'gcsBucketName'],
    { singleton: true }
  );

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

  container.register(
    'videoAssetStore',
    (gcsBucket: Bucket) =>
      createVideoAssetStore({
        bucket: gcsBucket,
        basePath: process.env.VIDEO_STORAGE_BASE_PATH || 'video-previews',
        signedUrlTtlMs: resolveSignedUrlTtlMs(
          process.env.VIDEO_STORAGE_SIGNED_URL_TTL_SECONDS,
          SIGNED_URL_TTL_MS.view
        ),
        cacheControl: process.env.VIDEO_STORAGE_CACHE_CONTROL || 'public, max-age=86400',
      }),
    ['gcsBucket'],
    { singleton: true }
  );
  container.register(
    'imageAssetStore',
    (gcsBucket: Bucket) =>
      createImageAssetStore({
        bucket: gcsBucket,
        basePath: process.env.IMAGE_STORAGE_BASE_PATH || 'image-previews',
        signedUrlTtlMs: resolveSignedUrlTtlMs(
          process.env.IMAGE_STORAGE_SIGNED_URL_TTL_SECONDS,
          SIGNED_URL_TTL_MS.view
        ),
        cacheControl: process.env.IMAGE_STORAGE_CACHE_CONTROL || 'public, max-age=86400',
      }),
    ['gcsBucket'],
    { singleton: true }
  );
  container.register(
    'convergenceStorageService',
    (gcsBucket: Bucket) => createGCSStorageService(gcsBucket),
    ['gcsBucket'],
    { singleton: true }
  );
  container.register(
    'videoJobStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) => new VideoJobStore(firestoreCircuitExecutor),
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );
  container.register('videoContentAccessService', () => createVideoContentAccessService(), [], { singleton: true });

  container.register(
    'requestIdempotencyService',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new RequestIdempotencyService(firestoreCircuitExecutor, {
        pendingLockTtlMs: resolvePositiveNumber(
          process.env.VIDEO_GENERATE_IDEMPOTENCY_PENDING_TTL_MS,
          6 * 60 * 1000,
          60_000
        ),
        replayTtlMs: resolvePositiveNumber(
          process.env.VIDEO_GENERATE_IDEMPOTENCY_REPLAY_TTL_MS,
          24 * 60 * 60 * 1000,
          60_000
        ),
      }),
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );

  container.register(
    'videoAssetRetentionService',
    (videoAssetStore: VideoAssetStore) =>
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
    replicate: {
      apiToken: process.env.REPLICATE_API_TOKEN,
    },
    fal: {
      apiKey: resolveFalApiKey() || undefined,
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
    (redisClient: ReturnType<typeof createRedisClient>, config: ServiceConfig, metricsService: MetricsService) => initSpanLabelingCache({
      redis: redisClient as RedisClient | null,
      defaultTTL: config.redis.defaultTTL,
      shortTTL: config.redis.shortTTL,
      maxMemoryCacheSize: config.redis.maxMemoryCacheSize,
    }, metricsService),
    ['redisClient', 'config', 'metricsService']
  );
}
