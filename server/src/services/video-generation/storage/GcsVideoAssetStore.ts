import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import type { Bucket, File } from '@google-cloud/storage';
import { admin } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import type { StoredVideoAsset, VideoAssetStore, VideoAssetStream } from './types';

interface GcsVideoAssetStoreOptions {
  bucketName: string;
  basePath: string;
  signedUrlTtlMs: number;
  cacheControl: string;
}

export class GcsVideoAssetStore implements VideoAssetStore {
  private readonly bucket: Bucket;
  private readonly basePath: string;
  private readonly signedUrlTtlMs: number;
  private readonly cacheControl: string;
  private readonly log = logger.child({ service: 'GcsVideoAssetStore' });

  constructor(options: GcsVideoAssetStoreOptions) {
    this.bucket = admin.storage().bucket(options.bucketName);
    this.basePath = options.basePath.replace(/^\/+|\/+$/g, '');
    this.signedUrlTtlMs = options.signedUrlTtlMs;
    this.cacheControl = options.cacheControl;
  }

  async storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredVideoAsset> {
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
    const url = await this.getSignedUrl(file);
    return {
      id,
      url,
      contentType,
      createdAt: Date.now(),
      sizeBytes: Number(metadata.size || 0) || undefined,
    };
  }

  async storeFromStream(stream: NodeJS.ReadableStream, contentType: string): Promise<StoredVideoAsset> {
    const id = uuidv4();
    const file = this.bucket.file(this.objectPath(id));

    await pipeline(
      stream,
      file.createWriteStream({
        metadata: {
          contentType,
          cacheControl: this.cacheControl,
        },
      })
    );

    const [metadata] = await file.getMetadata();
    const url = await this.getSignedUrl(file);
    return {
      id,
      url,
      contentType,
      createdAt: Date.now(),
      sizeBytes: Number(metadata.size || 0) || undefined,
    };
  }

  async getStream(assetId: string): Promise<VideoAssetStream | null> {
    const file = this.bucket.file(this.objectPath(assetId));
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [metadata] = await file.getMetadata();
    const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : 'video/mp4';
    const sizeBytes = Number(metadata.size || 0) || undefined;

    return {
      stream: file.createReadStream(),
      contentType,
      contentLength: sizeBytes,
    };
  }

  async getPublicUrl(assetId: string): Promise<string | null> {
    const file = this.bucket.file(this.objectPath(assetId));
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    return await this.getSignedUrl(file);
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
        this.log.warn('Failed to delete expired video asset', {
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

  private async getSignedUrl(file: File): Promise<string> {
    const expiresAt = Date.now() + this.signedUrlTtlMs;
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });
    return url;
  }
}
