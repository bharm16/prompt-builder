/**
 * Image Asset Storage
 *
 * Factory and exports for image storage (GCS or local).
 */

import { logger } from '@infrastructure/Logger';
import { GcsImageAssetStore } from './GcsImageAssetStore';
import type { ImageAssetStore } from './types';

const DEFAULT_BASE_PATH = 'image-previews';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';

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
  if (provider && provider !== 'gcs') {
    throw new Error(`Unsupported IMAGE_STORAGE_PROVIDER: ${provider}. Only "gcs" is supported.`);
  }

  const rawBucketName = process.env.IMAGE_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME;
  const normalizedBucket = rawBucketName ? normalizeBucketName(rawBucketName) : null;
  const bucketName = normalizedBucket?.bucketName;

  // Use GCS if explicitly configured or bucket name is available
  if (!bucketName) {
    throw new Error('Missing required env var for image storage: IMAGE_STORAGE_BUCKET (or GCS_BUCKET_NAME)');
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
  return new GcsImageAssetStore({
    bucketName,
    basePath,
    signedUrlTtlMs,
    cacheControl,
  });
}

export type { ImageAssetStore, StoredImageAsset } from './types';
