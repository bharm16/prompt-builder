/**
 * Local Image Asset Store
 *
 * Stores images to local filesystem (development fallback).
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type { ImageAssetStore, StoredImageAsset } from './types';

interface LocalImageAssetStoreOptions {
  directory: string;
  publicPath: string;
}

export class LocalImageAssetStore implements ImageAssetStore {
  private readonly directory: string;
  private readonly publicPath: string;
  private readonly log = logger.child({ service: 'LocalImageAssetStore' });
  private initialized = false;

  constructor(options: LocalImageAssetStoreOptions) {
    this.directory = path.resolve(options.directory);
    this.publicPath = options.publicPath.replace(/\/+$/, '');
  }

  private async ensureDirectory(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.directory, { recursive: true });
    this.initialized = true;
  }

  async storeFromUrl(sourceUrl: string, contentType?: string): Promise<StoredImageAsset> {
    await this.ensureDirectory();

    const id = uuidv4();
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const resolvedContentType =
      contentType || response.headers.get('content-type') || 'image/webp';

    const extension = this.getExtension(resolvedContentType);
    const filename = `${id}${extension}`;
    const filePath = path.join(this.directory, filename);

    await fs.writeFile(filePath, buffer);

    const stats = await fs.stat(filePath);
    const url = `${this.publicPath}/${id}`;

    this.log.info('Stored image locally', { id, sizeBytes: stats.size });

    return {
      id,
      storagePath: filename,
      url,
      contentType: resolvedContentType,
      createdAt: Date.now(),
      sizeBytes: stats.size,
    };
  }

  async storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredImageAsset> {
    await this.ensureDirectory();

    const id = uuidv4();
    const extension = this.getExtension(contentType);
    const filename = `${id}${extension}`;
    const filePath = path.join(this.directory, filename);

    await fs.writeFile(filePath, buffer);

    const stats = await fs.stat(filePath);
    const url = `${this.publicPath}/${id}`;

    return {
      id,
      storagePath: filename,
      url,
      contentType,
      createdAt: Date.now(),
      sizeBytes: stats.size,
    };
  }

  async getPublicUrl(assetId: string): Promise<string | null> {
    const exists = await this.exists(assetId);
    if (!exists) {
      return null;
    }
    return `${this.publicPath}/${assetId}`;
  }

  async exists(assetId: string): Promise<boolean> {
    const files = await this.findAssetFiles(assetId);
    return files.length > 0;
  }

  async cleanupExpired(olderThanMs: number, maxItems?: number): Promise<number> {
    if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) {
      return 0;
    }

    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.directory);
      let deleted = 0;

      for (const file of files) {
        if (maxItems && deleted >= maxItems) {
          break;
        }

        const filePath = path.join(this.directory, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs < olderThanMs) {
            await fs.unlink(filePath);
            deleted += 1;
          }
        } catch {
          // Ignore individual file errors
        }
      }

      return deleted;
    } catch {
      return 0;
    }
  }

  private async findAssetFiles(assetId: string): Promise<string[]> {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.directory);
      return files.filter((f) => f.startsWith(assetId));
    } catch {
      return [];
    }
  }

  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/webp': '.webp',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
    };
    return map[contentType] || '.webp';
  }
}
