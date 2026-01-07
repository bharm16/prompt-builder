import { logger } from '@infrastructure/Logger';
import { LocalVideoAssetStore } from './LocalVideoAssetStore';
import { GcsVideoAssetStore } from './GcsVideoAssetStore';
import type { VideoAssetStore } from './types';

const DEFAULT_PUBLIC_PATH = '/api/preview/video/content';
const DEFAULT_BASE_PATH = 'video-previews';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;
const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';

export function createVideoAssetStore(): VideoAssetStore {
  const provider = process.env.VIDEO_STORAGE_PROVIDER;
  const bucketName =
    process.env.VIDEO_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;

  if (provider === 'gcs' || (!provider && bucketName)) {
    if (!bucketName) {
      throw new Error('VIDEO_STORAGE_BUCKET is required for GCS video storage');
    }

    const signedUrlTtlSeconds = Number.parseInt(
      process.env.VIDEO_STORAGE_SIGNED_URL_TTL_SECONDS || String(DEFAULT_SIGNED_URL_TTL_SECONDS),
      10
    );
    const signedUrlTtlMs = Number.isFinite(signedUrlTtlSeconds)
      ? signedUrlTtlSeconds * 1000
      : DEFAULT_SIGNED_URL_TTL_SECONDS * 1000;
    const basePath = process.env.VIDEO_STORAGE_BASE_PATH || DEFAULT_BASE_PATH;
    const cacheControl = process.env.VIDEO_STORAGE_CACHE_CONTROL || DEFAULT_CACHE_CONTROL;

    logger.info('Using GCS video storage', { bucketName, basePath });
    return new GcsVideoAssetStore({
      bucketName,
      basePath,
      signedUrlTtlMs,
      cacheControl,
    });
  }

  const directory = process.env.VIDEO_STORAGE_DIR || './storage/videos';
  logger.info('Using local video storage', { directory });
  return new LocalVideoAssetStore({
    directory,
    publicPath: DEFAULT_PUBLIC_PATH,
  });
}

export type { VideoAssetStore, StoredVideoAsset, VideoAssetStream } from './types';
