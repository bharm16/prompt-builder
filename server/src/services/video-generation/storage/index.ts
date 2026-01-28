import { logger } from '@infrastructure/Logger';
import { GcsVideoAssetStore } from './GcsVideoAssetStore';
import type { VideoAssetStore } from './types';

const DEFAULT_BASE_PATH = 'video-previews';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;
const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';

interface NormalizedBucketResult {
  bucketName: string;
  changed: boolean;
  original: string;
}

function normalizeBucketName(raw: string): NormalizedBucketResult | null {
  const original = raw.trim();
  if (!original) {
    return null;
  }

  let bucketName = original;

  if (bucketName.startsWith('gs://')) {
    bucketName = bucketName.slice(5);
  }

  if (bucketName.startsWith('http://') || bucketName.startsWith('https://')) {
    try {
      const parsed = new URL(bucketName);
      if (parsed.hostname === 'firebasestorage.googleapis.com') {
        const match = parsed.pathname.match(/\/b\/([^/]+)\/o/);
        if (match?.[1]) {
          bucketName = match[1];
        }
      } else if (parsed.hostname === 'storage.googleapis.com') {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts[0]) {
          bucketName = pathParts[0];
        }
      } else {
        bucketName = parsed.hostname;
      }
    } catch {
      // Keep original if parsing fails.
    }
  }

  if (bucketName.endsWith('.firebasestorage.app')) {
    bucketName = bucketName.replace(/\.firebasestorage\.app$/, '.appspot.com');
  }

  return {
    bucketName,
    changed: bucketName !== original,
    original,
  };
}

export function createVideoAssetStore(): VideoAssetStore {
  const provider = process.env.VIDEO_STORAGE_PROVIDER;
  if (provider && provider !== 'gcs') {
    throw new Error(`Unsupported VIDEO_STORAGE_PROVIDER: ${provider}. Only "gcs" is supported.`);
  }

  const rawBucketName = process.env.VIDEO_STORAGE_BUCKET || process.env.GCS_BUCKET_NAME;
  const normalizedBucket = rawBucketName ? normalizeBucketName(rawBucketName) : null;
  const bucketName = normalizedBucket?.bucketName;

  if (!bucketName) {
    throw new Error(
      'Missing required env var for video storage: VIDEO_STORAGE_BUCKET (or GCS_BUCKET_NAME)'
    );
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

  if (normalizedBucket?.changed) {
    logger.warn('Normalized GCS bucket name for video storage', {
      original: normalizedBucket.original,
      bucketName,
    });
  }

  logger.info('Using GCS video storage', { bucketName, basePath });
  return new GcsVideoAssetStore({
    bucketName,
    basePath,
    signedUrlTtlMs,
    cacheControl,
  });
}

export type { VideoAssetStore, StoredVideoAsset, VideoAssetStream } from './types';
