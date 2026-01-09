import { logger } from '@infrastructure/Logger';
import { LocalVideoAssetStore } from './LocalVideoAssetStore';
import { GcsVideoAssetStore } from './GcsVideoAssetStore';
import type { StoredVideoAsset, VideoAssetStore, VideoAssetStream } from './types';

const DEFAULT_PUBLIC_PATH = '/api/preview/video/content';
const DEFAULT_BASE_PATH = 'video-previews';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;
const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';
const BUCKET_NOT_FOUND_MESSAGE = 'specified bucket does not exist';

class FailoverVideoAssetStore implements VideoAssetStore {
  private readonly primary: VideoAssetStore;
  private readonly fallback: VideoAssetStore;
  private readonly allowFailover: boolean;
  private failedOver = false;
  private readonly log = logger.child({ service: 'VideoAssetStoreFailover' });

  constructor(primary: VideoAssetStore, fallback: VideoAssetStore, allowFailover: boolean) {
    this.primary = primary;
    this.fallback = fallback;
    this.allowFailover = allowFailover;
  }

  async storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredVideoAsset> {
    return this.storeWithFailover(
      () => this.primary.storeFromBuffer(buffer, contentType),
      () => this.fallback.storeFromBuffer(buffer, contentType),
      'storeFromBuffer'
    );
  }

  async storeFromStream(stream: NodeJS.ReadableStream, contentType: string): Promise<StoredVideoAsset> {
    if (!this.allowFailover) {
      return this.primary.storeFromStream(stream, contentType);
    }

    if (this.failedOver) {
      return this.fallback.storeFromStream(stream, contentType);
    }

    const buffer = await readStreamToBuffer(stream);
    return this.storeWithFailover(
      () => this.primary.storeFromBuffer(buffer, contentType),
      () => this.fallback.storeFromBuffer(buffer, contentType),
      'storeFromStream'
    );
  }

  async getStream(assetId: string): Promise<VideoAssetStream | null> {
    const primaryStream = await this.primary.getStream(assetId);
    if (primaryStream) {
      return primaryStream;
    }
    return await this.fallback.getStream(assetId);
  }

  async getPublicUrl(assetId: string): Promise<string | null> {
    const primaryUrl = await this.primary.getPublicUrl(assetId);
    if (primaryUrl) {
      return primaryUrl;
    }
    return await this.fallback.getPublicUrl(assetId);
  }

  async cleanupExpired(olderThanMs: number, maxItems?: number): Promise<number> {
    const primaryDeleted = await this.primary.cleanupExpired(olderThanMs, maxItems);
    const fallbackDeleted = await this.fallback.cleanupExpired(olderThanMs, maxItems);
    return primaryDeleted + fallbackDeleted;
  }

  private async storeWithFailover(
    primaryOperation: () => Promise<StoredVideoAsset>,
    fallbackOperation: () => Promise<StoredVideoAsset>,
    operation: string
  ): Promise<StoredVideoAsset> {
    if (this.failedOver) {
      return await fallbackOperation();
    }

    try {
      return await primaryOperation();
    } catch (error) {
      if (this.allowFailover && shouldFailoverStorage(error)) {
        this.failedOver = true;
        this.log.warn('Primary video storage unavailable; switching to local storage', {
          operation,
          error: formatStorageError(error),
        });
        return await fallbackOperation();
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
  if (status === 404) {
    return true;
  }

  const responseStatus = (error as { response?: { status?: number } }).response?.status;
  if (responseStatus === 404) {
    return true;
  }

  const responseCode = (error as { response?: { data?: { error?: { code?: number } } } }).response?.data?.error?.code;
  return responseCode === 404;
}

function formatStorageError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function readStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(String(chunk)));
    }
  }
  return Buffer.concat(chunks);
}

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
  const rawBucketName =
    process.env.VIDEO_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
  const normalizedBucket = rawBucketName ? normalizeBucketName(rawBucketName) : null;
  const bucketName = normalizedBucket?.bucketName;
  const allowFailover = process.env.NODE_ENV !== 'production';

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

    if (normalizedBucket?.changed) {
      logger.warn('Normalized GCS bucket name for video storage', {
        original: normalizedBucket.original,
        bucketName,
      });
    }

    logger.info('Using GCS video storage', { bucketName, basePath });
    const primaryStore = new GcsVideoAssetStore({
      bucketName,
      basePath,
      signedUrlTtlMs,
      cacheControl,
    });

    if (allowFailover) {
      const directory = process.env.VIDEO_STORAGE_DIR || './storage/videos';
      logger.warn('Local video storage failover enabled for development', { directory });
      const fallbackStore = new LocalVideoAssetStore({
        directory,
        publicPath: DEFAULT_PUBLIC_PATH,
      });
      return new FailoverVideoAssetStore(primaryStore, fallbackStore, allowFailover);
    }

    return primaryStore;
  }

  const directory = process.env.VIDEO_STORAGE_DIR || './storage/videos';
  logger.info('Using local video storage', { directory });
  return new LocalVideoAssetStore({
    directory,
    publicPath: DEFAULT_PUBLIC_PATH,
  });
}

export type { VideoAssetStore, StoredVideoAsset, VideoAssetStream } from './types';
