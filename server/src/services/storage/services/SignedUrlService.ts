import { Storage } from '@google-cloud/storage';
import { STORAGE_CONFIG } from '../config/storageConfig';

export class SignedUrlService {
  private readonly storage: Storage;
  private readonly bucket;

  constructor(storage?: Storage) {
    this.storage = storage || new Storage();
    this.bucket = this.storage.bucket(STORAGE_CONFIG.bucketName);
  }

  async getUploadUrl(path: string, contentType: string, maxSize?: number | null): Promise<{
    uploadUrl: string;
    expiresAt: string;
  }> {
    const file = this.bucket.file(path);
    const expiresAtMs = Date.now() + STORAGE_CONFIG.urlExpiration.upload;

    const options: Record<string, unknown> = {
      version: 'v4',
      action: 'write',
      expires: expiresAtMs,
      contentType,
    };

    if (maxSize) {
      options.extensionHeaders = {
        'x-goog-content-length-range': `0,${maxSize}`,
      };
    }

    const [url] = await file.getSignedUrl(options);
    return {
      uploadUrl: url,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async getViewUrl(path: string, disposition = 'inline'): Promise<{
    viewUrl: string;
    expiresAt: string;
  }> {
    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found: ${path}`);
    }

    const expiresAtMs = Date.now() + STORAGE_CONFIG.urlExpiration.view;
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: disposition,
    });

    return {
      viewUrl: url,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async getDownloadUrl(path: string, filename?: string | null): Promise<{
    downloadUrl: string;
    expiresAt: string;
  }> {
    const file = this.bucket.file(path);
    const downloadName = filename || path.split('/').pop() || 'download';
    const expiresAtMs = Date.now() + STORAGE_CONFIG.urlExpiration.download;

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: `attachment; filename="${downloadName}"`,
    });

    return {
      downloadUrl: url,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }
}

export default SignedUrlService;
