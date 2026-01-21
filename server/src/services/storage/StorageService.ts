import { Storage } from '@google-cloud/storage';
import { SignedUrlService } from './services/SignedUrlService';
import { UploadService } from './services/UploadService';
import { RetentionService } from './services/RetentionService';
import { ensureGcsCredentials } from '@utils/gcsCredentials';
import {
  STORAGE_CONFIG,
  STORAGE_TYPES,
  resolveStorageTypeKey,
  type StorageType,
} from './config/storageConfig';
import { generateStoragePath, validatePathOwnership } from './utils/pathUtils';

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
  const key = resolveStorageTypeKey(type);
  const allowed = STORAGE_CONFIG.allowedContentTypes[key] || [];
  const normalized = normalizeContentType(contentType);
  return allowed.some((allowedType) => normalized.startsWith(allowedType));
}

export class StorageService {
  private readonly storage: Storage;
  private readonly bucket;
  private readonly signedUrlService: SignedUrlService;
  private readonly uploadService: UploadService;
  private readonly retentionService: RetentionService;

  constructor(dependencies: {
    storage?: Storage;
    signedUrlService?: SignedUrlService;
    uploadService?: UploadService;
    retentionService?: RetentionService;
  } = {}) {
    if (!dependencies.storage) {
      ensureGcsCredentials();
    }
    this.storage = dependencies.storage || new Storage();
    this.bucket = this.storage.bucket(STORAGE_CONFIG.bucketName);
    this.signedUrlService = dependencies.signedUrlService || new SignedUrlService(this.storage);
    this.uploadService = dependencies.uploadService || new UploadService(this.storage);
    this.retentionService = dependencies.retentionService || new RetentionService(this.storage);
  }

  async getUploadUrl(
    userId: string,
    type: StorageType,
    contentType: string,
    _metadata: Record<string, unknown> = {}
  ): Promise<{
    uploadUrl: string;
    storagePath: string;
    expiresAt: string;
    maxSizeBytes: number;
  }> {
    if (!Object.values(STORAGE_TYPES).includes(type)) {
      throw new Error(`Invalid storage type: ${type}`);
    }

    const normalizedContentType = normalizeContentType(contentType);
    if (!isAllowedContentType(type, normalizedContentType)) {
      throw new Error(`Invalid content type ${normalizedContentType} for type ${type}`);
    }

    const extension = resolveExtension(normalizedContentType);
    const path = generateStoragePath(userId, type, extension);
    const maxSize = STORAGE_CONFIG.maxFileSize[resolveStorageTypeKey(type)];

    const { uploadUrl, expiresAt } = await this.signedUrlService.getUploadUrl(
      path,
      normalizedContentType,
      maxSize
    );

    void _metadata;

    return {
      uploadUrl,
      storagePath: path,
      expiresAt,
      maxSizeBytes: maxSize,
    };
  }

  async saveFromUrl(
    userId: string,
    sourceUrl: string,
    type: StorageType,
    metadata: Record<string, unknown> = {}
  ): Promise<{
    storagePath: string;
    viewUrl: string;
    expiresAt: string;
    sizeBytes: number;
    contentType: string;
    createdAt: string;
  }> {
    if (!Object.values(STORAGE_TYPES).includes(type)) {
      throw new Error(`Invalid storage type: ${type}`);
    }

    const uploadResult = await this.uploadService.uploadFromUrl(
      sourceUrl,
      userId,
      type,
      metadata
    );

    const { viewUrl, expiresAt } = await this.signedUrlService.getViewUrl(
      uploadResult.storagePath
    );

    return {
      ...uploadResult,
      viewUrl,
      expiresAt,
    };
  }

  async confirmUpload(userId: string, storagePath: string): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string | undefined;
    createdAt: string;
  }> {
    return this.uploadService.confirmUpload(storagePath, userId);
  }

  async getViewUrl(
    userId: string,
    storagePath: string
  ): Promise<{ viewUrl: string; expiresAt: string }> {
    if (!validatePathOwnership(storagePath, userId)) {
      throw new Error('Unauthorized - cannot access files belonging to other users');
    }

    return this.signedUrlService.getViewUrl(storagePath);
  }

  async getDownloadUrl(
    userId: string,
    storagePath: string,
    filename?: string | null
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    if (!validatePathOwnership(storagePath, userId)) {
      throw new Error('Unauthorized - cannot access files belonging to other users');
    }

    return this.signedUrlService.getDownloadUrl(storagePath, filename);
  }

  async listFiles(
    userId: string,
    options: { type?: string | null; limit?: number; pageToken?: string | null } = {}
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    return this.retentionService.listUserFiles(userId, options);
  }

  async deleteFile(userId: string, storagePath: string): Promise<{ deleted: boolean; path: string }> {
    return this.retentionService.deleteFile(storagePath, userId);
  }

  async deleteFiles(
    userId: string,
    storagePaths: string[]
  ): Promise<{ deleted: number; failed: number; details: unknown[] }> {
    return this.retentionService.deleteFiles(storagePaths, userId);
  }

  async getStorageUsage(userId: string): Promise<{
    totalBytes: number;
    totalMB: number;
    byType: Record<string, number>;
    fileCount: number;
  }> {
    return this.retentionService.getUserStorageUsage(userId);
  }

  async fileExists(storagePath: string): Promise<boolean> {
    const file = this.bucket.file(storagePath);
    const [exists] = await file.exists();
    return exists;
  }

  async getFileMetadata(
    userId: string,
    storagePath: string
  ): Promise<{
    storagePath: string;
    sizeBytes: number;
    contentType: string | undefined;
    createdAt: string;
    updatedAt: string | undefined;
    metadata: Record<string, unknown>;
  }> {
    if (!validatePathOwnership(storagePath, userId)) {
      throw new Error('Unauthorized');
    }

    const file = this.bucket.file(storagePath);
    const [metadata] = await file.getMetadata();

    return {
      storagePath,
      sizeBytes: Number.parseInt(metadata.size || '0', 10),
      contentType: metadata.contentType,
      createdAt: metadata.timeCreated,
      updatedAt: metadata.updated,
      metadata: metadata.metadata || {},
    };
  }
}

let instance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!instance) {
    instance = new StorageService();
  }
  return instance;
}

export default StorageService;
