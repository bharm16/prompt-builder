import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import type { StoredVideoAsset, VideoAssetStore, VideoAssetStream } from './types';

interface LocalVideoAssetStoreOptions {
  directory: string;
  publicPath: string;
}

interface LocalVideoMetadata {
  contentType: string;
  sizeBytes: number;
  createdAt: number;
}

export class LocalVideoAssetStore implements VideoAssetStore {
  private readonly directory: string;
  private readonly publicPath: string;

  constructor(options: LocalVideoAssetStoreOptions) {
    this.directory = options.directory;
    this.publicPath = options.publicPath.replace(/\/+$/, '');
  }

  async storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredVideoAsset> {
    await mkdir(this.directory, { recursive: true });
    const id = uuidv4();
    const dataPath = path.join(this.directory, id);
    await writeFile(dataPath, buffer);

    const fileStats = await stat(dataPath);
    const metadata: LocalVideoMetadata = {
      contentType,
      sizeBytes: fileStats.size,
      createdAt: Date.now(),
    };
    await writeFile(this.metadataPath(id), JSON.stringify(metadata));

    return {
      id,
      url: this.buildPublicUrl(id),
      contentType,
      createdAt: metadata.createdAt,
      sizeBytes: metadata.sizeBytes,
    };
  }

  async storeFromStream(stream: NodeJS.ReadableStream, contentType: string): Promise<StoredVideoAsset> {
    await mkdir(this.directory, { recursive: true });
    const id = uuidv4();
    const dataPath = path.join(this.directory, id);

    await pipeline(stream, createWriteStream(dataPath));

    const fileStats = await stat(dataPath);
    const metadata: LocalVideoMetadata = {
      contentType,
      sizeBytes: fileStats.size,
      createdAt: Date.now(),
    };
    await writeFile(this.metadataPath(id), JSON.stringify(metadata));

    return {
      id,
      url: this.buildPublicUrl(id),
      contentType,
      createdAt: metadata.createdAt,
      sizeBytes: metadata.sizeBytes,
    };
  }

  async getStream(assetId: string): Promise<VideoAssetStream | null> {
    const metadata = await this.readMetadata(assetId);
    if (!metadata) {
      return null;
    }

    const dataPath = path.join(this.directory, assetId);
    if (!existsSync(dataPath)) {
      return null;
    }

    return {
      stream: createReadStream(dataPath),
      contentType: metadata.contentType,
      contentLength: metadata.sizeBytes,
    };
  }

  async getPublicUrl(assetId: string): Promise<string | null> {
    const metadata = await this.readMetadata(assetId);
    if (!metadata) {
      return null;
    }
    return this.buildPublicUrl(assetId);
  }

  private buildPublicUrl(assetId: string): string {
    return `${this.publicPath}/${assetId}`;
  }

  private metadataPath(assetId: string): string {
    return path.join(this.directory, `${assetId}.json`);
  }

  private async readMetadata(assetId: string): Promise<LocalVideoMetadata | null> {
    const metaPath = this.metadataPath(assetId);
    if (!existsSync(metaPath)) {
      return null;
    }

    const raw = await readFile(metaPath, 'utf8');
    try {
      const parsed = JSON.parse(raw) as LocalVideoMetadata;
      if (!parsed || typeof parsed.contentType !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
