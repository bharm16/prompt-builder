/**
 * GCS Image Asset Store
 *
 * Stores generated images to Google Cloud Storage.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Bucket, File } from '@google-cloud/storage';
import { admin } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import type { ImageAssetStore, StoredImageAsset } from './types';

interface GcsImageAssetStoreOptions {
  bucketName: string;
  basePath: string;
  signedUrlTtlMs: number;
  cacheControl: string;
}

export class GcsImageAssetStore implements ImageAssetStore {
  private readonly bucket: Bucket;
  private readonly basePath: string;
  private readonly signedUrlTtlMs: number;
  private readonly cacheControl: string;
  private readonly log = logger.child({ service: 'GcsImageAssetStore' });

  constructor(options: GcsImageAssetStoreOptions) {
    this.bucket = admin.storage().bucket(options.bucketName);
    this.basePath = options.basePath.replace(/^\/+|\/+$/g, '');
    this.signedUrlTtlMs = options.signedUrlTtlMs;
    this.cacheControl = options.cacheControl;
  }

  async storeFromUrl(sourceUrl: string, contentType?: string): Promise<StoredImageAsset> {
    const id = uuidv4();
    const file = this.bucket.file(this.objectPath(id));

    this.log.debug('Fetching image from source URL', { sourceUrl: sourceUrl.slice(0, 100) });

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const resolvedContentType =
      contentType || response.headers.get('content-type') || 'image/webp';

    await file.save(buffer, {
      contentType: resolvedContentType,
      resumable: false,
      metadata: {
        cacheControl: this.cacheControl,
        metadata: {
          sourceUrl: sourceUrl.slice(0, 500),
        },
      },
    });

    const [metadata] = await file.getMetadata();
    const { url, expiresAt } = await this.getSignedUrl(file);
    const resolvedSize = Number(metadata.size || 0);
    const sizeBytes = Number.isFinite(resolvedSize) && resolvedSize > 0 ? resolvedSize : undefined;

    this.log.info('Stored image to GCS', {
      id,
      sizeBytes,
      contentType: resolvedContentType,
    });

    return {
      id,
      url,
      contentType: resolvedContentType,
      createdAt: Date.now(),
      expiresAt,
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    };
  }

  async storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredImageAsset> {
    const id = uuidv4();
    const file = this.bucket.file(this.objectPath(id));

    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: this.cacheControl,
      },
    });

    const [metadata] = await file.getMetadata();
    const { url, expiresAt } = await this.getSignedUrl(file);
    const resolvedSize = Number(metadata.size || 0);
    const sizeBytes = Number.isFinite(resolvedSize) && resolvedSize > 0 ? resolvedSize : undefined;

    return {
      id,
      url,
      contentType,
      createdAt: Date.now(),
      expiresAt,
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    };
  }

  async getPublicUrl(assetId: string): Promise<string | null> {
    const file = this.bucket.file(this.objectPath(assetId));
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    const { url } = await this.getSignedUrl(file);
    return url;
  }

  async exists(assetId: string): Promise<boolean> {
    const file = this.bucket.file(this.objectPath(assetId));
    const [exists] = await file.exists();
    return exists;
  }

  async cleanupExpired(olderThanMs: number, maxItems?: number): Promise<number> {
    if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) {
      return 0;
    }

    const prefix = `${this.basePath}/`;
    const [files] = await this.bucket.getFiles({ prefix });
    let deleted = 0;

    for (const file of files) {
      if (maxItems && deleted >= maxItems) {
        break;
      }

      try {
        const [metadata] = await file.getMetadata();
        const createdAt = metadata.timeCreated ? Date.parse(metadata.timeCreated) : NaN;
        if (!Number.isFinite(createdAt) || createdAt > olderThanMs) {
          continue;
        }

        await file.delete();
        deleted += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log.warn('Failed to delete expired image asset', {
          fileName: file.name,
          error: errorMessage,
        });
      }
    }

    return deleted;
  }

  private objectPath(assetId: string): string {
    return `${this.basePath}/${assetId}`;
  }

  private async getSignedUrl(file: File): Promise<{ url: string; expiresAt: number }> {
    const expiresAt = Date.now() + this.signedUrlTtlMs;
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });
    return { url, expiresAt };
  }
}
