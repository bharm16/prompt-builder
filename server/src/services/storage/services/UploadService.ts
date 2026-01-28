import { Storage } from '@google-cloud/storage';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import {
  STORAGE_CONFIG,
  STORAGE_TYPES,
  resolveStorageTypeKey,
  type StorageType,
} from '../config/storageConfig';
import { generateStoragePath, validatePathOwnership } from '../utils/pathUtils';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const RESUMABLE_THRESHOLD_BYTES = 5 * 1024 * 1024;

function normalizeContentType(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase();
}

function resolveExtension(contentType: string): string {
  const normalized = normalizeContentType(contentType);
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'video/quicktime') return 'mov';
  const parts = normalized.split('/');
  return parts[1] || 'bin';
}

function isAllowedContentType(type: StorageType, contentType: string): boolean {
  const typeKey = resolveStorageTypeKey(type);
  const allowed = STORAGE_CONFIG.allowedContentTypes[typeKey] || [];
  const normalized = normalizeContentType(contentType);
  return allowed.some((allowedType) => normalized.startsWith(allowedType));
}

function toNodeReadableStream(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream | null
): NodeJS.ReadableStream {
  if (!body) {
    throw new Error('Response body is empty');
  }
  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') {
    return body as NodeJS.ReadableStream;
  }
  return Readable.fromWeb(body as ReadableStream<Uint8Array>);
}

export class UploadService {
  private readonly storage: Storage;
  private readonly bucket;

  constructor(storage?: Storage) {
    this.storage = storage || new Storage();
    this.bucket = this.storage.bucket(STORAGE_CONFIG.bucketName);
  }

  async uploadFromUrl(
    sourceUrl: string,
    userId: string,
    type: StorageType,
    metadata: Record<string, unknown> = {}
  ): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string;
    createdAt: string;
  }> {
    if (!Object.values(STORAGE_TYPES).includes(type)) {
      throw new Error(`Invalid storage type: ${type}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(sourceUrl, { signal: controller.signal, redirect: 'follow' });

      if (!response.ok) {
        throw new Error(`Failed to fetch source: ${response.status} ${response.statusText}`);
      }

      const contentType = normalizeContentType(
        response.headers.get('content-type') || 'application/octet-stream'
      );
      if (!isAllowedContentType(type, contentType)) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;
      const maxSize = STORAGE_CONFIG.maxFileSize[resolveStorageTypeKey(type)];
      if (contentLength && contentLength > maxSize) {
        throw new Error(`File too large: ${contentLength} bytes (max: ${maxSize})`);
      }

      const extension = resolveExtension(contentType);
      const path = generateStoragePath(userId, type, extension);
      const file = this.bucket.file(path);

      const model = typeof metadata.model === 'string' ? metadata.model : 'unknown';
      const promptId = typeof metadata.promptId === 'string' ? metadata.promptId : '';

      await pipeline(
        toNodeReadableStream(response.body as ReadableStream<Uint8Array> | null),
        file.createWriteStream({
          metadata: {
            contentType,
            metadata: {
              ...metadata,
              userId,
              type,
              sourceUrl: sourceUrl.slice(0, 200),
              model,
              promptId,
              createdAt: new Date().toISOString(),
            },
          },
          resumable: contentLength ? contentLength > RESUMABLE_THRESHOLD_BYTES : true,
        })
      );

      const [fileMetadata] = await file.getMetadata();

      return {
        storagePath: path,
        sizeBytes: Number.parseInt(fileMetadata.size || '0', 10),
        contentType: fileMetadata.contentType || contentType,
        createdAt: fileMetadata.timeCreated,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async uploadFromBuffer(
    buffer: Buffer,
    userId: string,
    type: StorageType,
    contentType: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string;
    createdAt: string;
  }> {
    if (!Object.values(STORAGE_TYPES).includes(type)) {
      throw new Error(`Invalid storage type: ${type}`);
    }

    const normalizedContentType = normalizeContentType(contentType);
    if (!isAllowedContentType(type, normalizedContentType)) {
      throw new Error(`Invalid content type: ${normalizedContentType}`);
    }

    const maxSize = STORAGE_CONFIG.maxFileSize[resolveStorageTypeKey(type)];
    if (buffer.length > maxSize) {
      throw new Error(`File too large: ${buffer.length} bytes (max: ${maxSize})`);
    }

    const extension = resolveExtension(normalizedContentType);
    const path = generateStoragePath(userId, type, extension);
    const file = this.bucket.file(path);

    const model = typeof metadata.model === 'string' ? metadata.model : 'unknown';
    const promptId = typeof metadata.promptId === 'string' ? metadata.promptId : '';

    await file.save(buffer, {
      contentType: normalizedContentType,
      resumable: buffer.length > RESUMABLE_THRESHOLD_BYTES,
      metadata: {
        metadata: {
          ...metadata,
          userId,
          type,
          model,
          promptId,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      storagePath: path,
      sizeBytes: buffer.length,
      contentType: normalizedContentType,
      createdAt: new Date().toISOString(),
    };
  }

  async uploadBuffer(
    buffer: Buffer,
    userId: string,
    type: StorageType,
    contentType: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string;
  }> {
    if (!Object.values(STORAGE_TYPES).includes(type)) {
      throw new Error(`Invalid storage type: ${type}`);
    }

    const typeKey = resolveStorageTypeKey(type);
    const maxSize = STORAGE_CONFIG.maxFileSize[typeKey];
    if (buffer.length > maxSize) {
      throw new Error(`File too large: ${buffer.length} bytes (max: ${maxSize})`);
    }

    const normalizedContentType = normalizeContentType(contentType);
    if (!isAllowedContentType(type, normalizedContentType)) {
      throw new Error(`Invalid content type: ${normalizedContentType}`);
    }

    const extension = resolveExtension(normalizedContentType);
    const path = generateStoragePath(userId, type, extension);
    const file = this.bucket.file(path);

    await file.save(buffer, {
      metadata: {
        contentType: normalizedContentType,
        metadata: {
          ...metadata,
          userId,
          type,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      storagePath: path,
      sizeBytes: buffer.length,
      contentType: normalizedContentType,
    };
  }

  async uploadStream(
    stream: NodeJS.ReadableStream,
    sizeBytes: number,
    userId: string,
    type: StorageType,
    contentType: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string;
  }> {
    if (!Object.values(STORAGE_TYPES).includes(type)) {
      throw new Error(`Invalid storage type: ${type}`);
    }

    const typeKey = resolveStorageTypeKey(type);
    const maxSize = STORAGE_CONFIG.maxFileSize[typeKey];
    if (sizeBytes > maxSize) {
      throw new Error(`File too large: ${sizeBytes} bytes (max: ${maxSize})`);
    }

    const normalizedContentType = normalizeContentType(contentType);
    if (!isAllowedContentType(type, normalizedContentType)) {
      throw new Error(`Invalid content type: ${normalizedContentType}`);
    }

    const extension = resolveExtension(normalizedContentType);
    const path = generateStoragePath(userId, type, extension);
    const file = this.bucket.file(path);

    await new Promise<void>((resolve, reject) => {
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: normalizedContentType,
          metadata: {
            ...metadata,
            userId,
            type,
            createdAt: new Date().toISOString(),
          },
        },
      });

      stream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
      stream.pipe(writeStream);
    });

    return {
      storagePath: path,
      sizeBytes,
      contentType: normalizedContentType,
    };
  }

  async confirmUpload(
    path: string,
    userId: string
  ): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string | undefined;
    createdAt: string;
  }> {
    if (!validatePathOwnership(path, userId)) {
      throw new Error('Unauthorized - file does not belong to user');
    }

    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Upload not found - may have failed or expired');
    }

    const [metadata] = await file.getMetadata();

    return {
      storagePath: path,
      sizeBytes: Number.parseInt(metadata.size || '0', 10),
      contentType: metadata.contentType,
      createdAt: metadata.timeCreated,
    };
  }
}

export default UploadService;
