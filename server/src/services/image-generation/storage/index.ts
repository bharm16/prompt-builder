/**
 * Image Asset Storage
 *
 * Factory and exports for image storage with GCS/local failover.
 */

import { logger } from '@infrastructure/Logger';
import { LocalImageAssetStore } from './LocalImageAssetStore';
import { GcsImageAssetStore } from './GcsImageAssetStore';
import type { ImageAssetStore, StoredImageAsset } from './types';

const DEFAULT_PUBLIC_PATH = '/api/preview/image/content';
const DEFAULT_BASE_PATH = 'image-previews';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';
const BUCKET_NOT_FOUND_MESSAGE = 'specified bucket does not exist';

/**
 * Failover store that tries GCS first, falls back to local in development
 */
class FailoverImageAssetStore implements ImageAssetStore {
  private readonly primary: ImageAssetStore;
  private readonly fallback: ImageAssetStore;
  private readonly allowFailover: boolean;
  private failedOver = false;
  private readonly log = logger.child({ service: 'ImageAssetStoreFailover' });

  constructor(primary: ImageAssetStore, fallback: ImageAssetStore, allowFailover: boolean) {
    this.primary = primary;
    this.fallback = fallback;
    this.allowFailover = allowFailover;
  }

  async storeFromUrl(sourceUrl: string, contentType?: string): Promise<StoredImageAsset> {
    return this.withFailover(
      () => this.primary.storeFromUrl(sourceUrl, contentType),
      () => this.fallback.storeFromUrl(sourceUrl, contentType),
      'storeFromUrl'
    );
  }

  async storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredImageAsset> {
    return this.withFailover(
      () => this.primary.storeFromBuffer(buffer, contentType),
      () => this.fallback.storeFromBuffer(buffer, contentType),
      'storeFromBuffer'
    );
  }

  async getPublicUrl(assetId: string): Promise<string | null> {
    const primaryUrl = await this.primary.getPublicUrl(assetId);
    if (primaryUrl) return primaryUrl;
    return await this.fallback.getPublicUrl(assetId);
  }

  async exists(assetId: string): Promise<boolean> {
    const primaryExists = await this.primary.exists(assetId);
    if (primaryExists) return true;
    return await this.fallback.exists(assetId);
  }

  async cleanupExpired(olderThanMs: number, maxItems?: number): Promise<number> {
    const primaryDeleted = await this.primary.cleanupExpired(olderThanMs, maxItems);
    const fallbackDeleted = await this.fallback.cleanupExpired(olderThanMs, maxItems);
    return primaryDeleted + fallbackDeleted;
  }

  private async withFailover<T>(
    primaryOp: () => Promise<T>,
    fallbackOp: () => Promise<T>,
    operation: string
  ): Promise<T> {
    if (this.failedOver) {
      return await fallbackOp();
    }

    try {
      return await primaryOp();
    } catch (error) {
      if (this.allowFailover && shouldFailoverStorage(error)) {
        this.failedOver = true;
        this.log.warn('Primary image storage unavailable; switching to local storage', {
          operation,
          error: formatStorageError(error),
        });
        return await fallbackOp();
      }
      throw error;
    }
  }
}

function shouldFailoverStorage(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes(BUCKET_NOT_FOUND_MESSAGE)) {
    return true;
  }

  const status = (error as { status?: number }).status;
  if (status === 404) return true;

  const responseStatus = (error as { response?: { status?: number } }).response?.status;
  if (responseStatus === 404) return true;

  return false;
}

function formatStorageError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeBucketName(raw: string): { bucketName: string; changed: boolean; original: string } | null {
  const original = raw.trim();
  if (!original) return null;

  let bucketName = original;

  if (bucketName.startsWith('gs://')) {
    bucketName = bucketName.slice(5);
  }

  if (bucketName.startsWith('http://') || bucketName.startsWith('https://')) {
    try {
      const parsed = new URL(bucketName);
      if (parsed.hostname === 'firebasestorage.googleapis.com') {
        const match = parsed.pathname.match(/\/b\/([^/]+)\/o/);
        if (match?.[1]) bucketName = match[1];
      } else if (parsed.hostname === 'storage.googleapis.com') {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts[0]) bucketName = pathParts[0];
      } else {
        bucketName = parsed.hostname;
      }
    } catch {
      // Keep original
    }
  }

  if (bucketName.endsWith('.firebasestorage.app')) {
    bucketName = bucketName.replace(/\.firebasestorage\.app$/, '.appspot.com');
  }

  return { bucketName, changed: bucketName !== original, original };
}

/**
 * Create an image asset store based on environment configuration
 */
export function createImageAssetStore(): ImageAssetStore {
  const provider = process.env.IMAGE_STORAGE_PROVIDER;
  const rawBucketName =
    process.env.IMAGE_STORAGE_BUCKET ||
    process.env.VIDEO_STORAGE_BUCKET ||
    process.env.GCS_BUCKET_NAME;
  const normalizedBucket = rawBucketName ? normalizeBucketName(rawBucketName) : null;
  const bucketName = normalizedBucket?.bucketName;
  const allowFailover = process.env.NODE_ENV !== 'production';

  // Use GCS if explicitly configured or bucket name is available
  if (provider === 'gcs' || (!provider && bucketName)) {
    if (!bucketName) {
      throw new Error('IMAGE_STORAGE_BUCKET is required for GCS image storage');
    }

    const signedUrlTtlSeconds = Number.parseInt(
      process.env.IMAGE_STORAGE_SIGNED_URL_TTL_SECONDS || String(DEFAULT_SIGNED_URL_TTL_SECONDS),
      10
    );
    const signedUrlTtlMs = Number.isFinite(signedUrlTtlSeconds)
      ? signedUrlTtlSeconds * 1000
      : DEFAULT_SIGNED_URL_TTL_SECONDS * 1000;
    const basePath = process.env.IMAGE_STORAGE_BASE_PATH || DEFAULT_BASE_PATH;
    const cacheControl = process.env.IMAGE_STORAGE_CACHE_CONTROL || DEFAULT_CACHE_CONTROL;

    if (normalizedBucket?.changed) {
      logger.warn('Normalized GCS bucket name for image storage', {
        original: normalizedBucket.original,
        bucketName,
      });
    }

    logger.info('Using GCS image storage', { bucketName, basePath });
    const primaryStore = new GcsImageAssetStore({
      bucketName,
      basePath,
      signedUrlTtlMs,
      cacheControl,
    });

    if (allowFailover) {
      const directory = process.env.IMAGE_STORAGE_DIR || './storage/images';
      logger.warn('Local image storage failover enabled for development', { directory });
      const fallbackStore = new LocalImageAssetStore({
        directory,
        publicPath: DEFAULT_PUBLIC_PATH,
      });
      return new FailoverImageAssetStore(primaryStore, fallbackStore, allowFailover);
    }

    return primaryStore;
  }

  // Default to local storage
  const directory = process.env.IMAGE_STORAGE_DIR || './storage/images';
  logger.info('Using local image storage', { directory });
  return new LocalImageAssetStore({
    directory,
    publicPath: DEFAULT_PUBLIC_PATH,
  });
}

export type { ImageAssetStore, StoredImageAsset } from './types';
