import type { DIContainer } from '@infrastructure/DIContainer';
import { Storage, type Bucket } from '@google-cloud/storage';
import { resolveBucketName } from '@config/storageBucket';
import { StorageService } from '@services/storage/StorageService';
import { createImageAssetStore } from '@services/image-generation/storage';
import { createVideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { createVideoAssetStore, type VideoAssetStore } from '@services/video-generation/storage';
import { createVideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import { createGCSStorageService, setConvergenceStorageSignedUrlTtl } from '@services/convergence/storage';
import type { ServiceConfig } from './service-config.types.ts';

export function registerStorageServices(container: DIContainer): void {
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
    'videoAssetStore',
    (gcsBucket: Bucket, config: ServiceConfig) =>
      createVideoAssetStore({
        bucket: gcsBucket,
        basePath: config.videoAssets.storage.basePath,
        signedUrlTtlMs: config.videoAssets.storage.signedUrlTtlMs,
        cacheControl: config.videoAssets.storage.cacheControl,
      }),
    ['gcsBucket', 'config'],
    { singleton: true }
  );
  container.register(
    'imageAssetStore',
    (gcsBucket: Bucket, config: ServiceConfig) =>
      createImageAssetStore({
        bucket: gcsBucket,
        basePath: config.imageAssets.storage.basePath,
        signedUrlTtlMs: config.imageAssets.storage.signedUrlTtlMs,
        cacheControl: config.imageAssets.storage.cacheControl,
      }),
    ['gcsBucket', 'config'],
    { singleton: true }
  );
  container.register(
    'convergenceStorageService',
    (gcsBucket: Bucket, config: ServiceConfig) => {
      setConvergenceStorageSignedUrlTtl(config.convergence.storage.signedUrlTtlSeconds);
      return createGCSStorageService(gcsBucket);
    },
    ['gcsBucket', 'config'],
    { singleton: true }
  );

  container.register(
    'videoAssetRetentionService',
    (videoAssetStore: VideoAssetStore, config: ServiceConfig) =>
      createVideoAssetRetentionService(videoAssetStore, config.videoAssets.retention),
    ['videoAssetStore', 'config'],
    { singleton: true }
  );

  container.register(
    'videoContentAccessService',
    (config: ServiceConfig) => createVideoContentAccessService(config.videoAssets.access),
    ['config'],
    { singleton: true }
  );
}
