/**
 * StorageService for Visual Convergence
 *
 * Handles permanent storage of generated images in GCS.
 * Replicate generates images with temporary URLs that expire,
 * so we need to persist them to GCS before storing in session state.
 *
 * @module convergence/storage
 */

import { Storage, Bucket } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import { ensureGcsCredentials } from '@utils/gcsCredentials';

// ============================================================================
// Interface
// ============================================================================

/**
 * Interface for storage operations in the convergence flow.
 * Abstracts GCS operations for easier testing and potential future storage backends.
 */
export interface StorageService {
  /**
   * Upload a single image from temporary URL to GCS
   * @param tempUrl Temporary Replicate URL
   * @param destination GCS path (e.g., "convergence/userId123/image.png")
   * @returns Permanent GCS URL
   */
  upload(tempUrl: string, destination: string): Promise<string>;

  /**
   * Upload multiple images in parallel
   * @param tempUrls Array of temporary Replicate URLs
   * @param destinationPrefix GCS path prefix (e.g., "convergence/userId123")
   * @returns Array of permanent GCS URLs in same order
   */
  uploadBatch(tempUrls: string[], destinationPrefix: string): Promise<string[]>;

  /**
   * Delete images (for cleanup on session abandonment)
   * @param gcsUrls Array of GCS URLs to delete
   */
  delete(gcsUrls: string[]): Promise<void>;
}

// ============================================================================
// Configuration
// ============================================================================

const CONVERGENCE_STORAGE_CONFIG = {
  /** Default content type for uploaded images */
  defaultContentType: 'image/png',
  /** Timeout for fetching from temporary URLs (5 minutes) */
  fetchTimeoutMs: 5 * 60 * 1000,
  /** Maximum concurrent uploads in a batch */
  maxConcurrentUploads: 10,
} as const;

// ============================================================================
// Implementation
// ============================================================================

/**
 * GCS implementation of StorageService for convergence images.
 *
 * Handles:
 * - Fetching images from temporary Replicate URLs
 * - Uploading to GCS with public access
 * - Batch uploads with parallel processing
 * - Cleanup of abandoned session images
 */
export class GCSStorageService implements StorageService {
  private readonly log = logger.child({ service: 'GCSStorageService' });

  constructor(private readonly bucket: Bucket) {}

  /**
   * Upload a single image from temporary URL to GCS
   *
   * @param tempUrl - Temporary URL (e.g., from Replicate)
   * @param destination - GCS path for the file
   * @returns Permanent public GCS URL
   * @throws Error if fetch or upload fails
   */
  async upload(tempUrl: string, destination: string): Promise<string> {
    const startTime = Date.now();
    this.log.debug('Starting image upload', { destination, tempUrlHost: this.getUrlHost(tempUrl) });

    try {
      // Fetch image from temporary URL with timeout
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        CONVERGENCE_STORAGE_CONFIG.fetchTimeoutMs
      );

      let response: Response;
      try {
        response = await fetch(tempUrl, {
          signal: controller.signal,
          redirect: 'follow',
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      // Get the image data as buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine content type from response or use default
      const contentType = this.normalizeContentType(
        response.headers.get('content-type') || CONVERGENCE_STORAGE_CONFIG.defaultContentType
      );

      // Upload to GCS
      const file = this.bucket.file(destination);
      await file.save(buffer, {
        contentType,
        public: true,
        metadata: {
          cacheControl: 'public, max-age=31536000', // 1 year cache
          metadata: {
            sourceUrl: tempUrl.slice(0, 200), // Truncate for metadata limits
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${destination}`;
      const duration = Date.now() - startTime;

      this.log.info('Image upload completed', {
        destination,
        sizeBytes: buffer.length,
        contentType,
        duration,
      });

      return publicUrl;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log.error('Image upload failed', error as Error, {
        destination,
        tempUrlHost: this.getUrlHost(tempUrl),
        duration,
      });
      throw error;
    }
  }

  /**
   * Upload multiple images in parallel
   *
   * @param tempUrls - Array of temporary URLs
   * @param destinationPrefix - GCS path prefix (e.g., "convergence/userId123")
   * @returns Array of permanent GCS URLs in same order as input
   * @throws Error if any upload fails
   */
  async uploadBatch(tempUrls: string[], destinationPrefix: string): Promise<string[]> {
    if (tempUrls.length === 0) {
      return [];
    }

    const startTime = Date.now();
    this.log.debug('Starting batch upload', {
      count: tempUrls.length,
      destinationPrefix,
    });

    try {
      // Generate unique destinations for each URL
      const uploadPromises = tempUrls.map((url) => {
        const filename = `${uuidv4()}.png`;
        const destination = `${destinationPrefix}/${filename}`;
        return this.upload(url, destination);
      });

      // Execute all uploads in parallel
      const results = await Promise.all(uploadPromises);

      const duration = Date.now() - startTime;
      this.log.info('Batch upload completed', {
        count: tempUrls.length,
        destinationPrefix,
        duration,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log.error('Batch upload failed', error as Error, {
        count: tempUrls.length,
        destinationPrefix,
        duration,
      });
      throw error;
    }
  }

  /**
   * Delete images from GCS (for cleanup on session abandonment)
   *
   * Silently ignores files that don't exist or can't be deleted.
   * This is intentional to ensure cleanup doesn't fail due to
   * already-deleted files.
   *
   * @param gcsUrls - Array of GCS URLs to delete
   */
  async delete(gcsUrls: string[]): Promise<void> {
    if (gcsUrls.length === 0) {
      return;
    }

    const startTime = Date.now();
    this.log.debug('Starting batch delete', { count: gcsUrls.length });

    const bucketUrlPrefix = `https://storage.googleapis.com/${this.bucket.name}/`;

    const deletePromises = gcsUrls.map(async (url) => {
      try {
        // Extract path from GCS URL
        if (!url.startsWith(bucketUrlPrefix)) {
          this.log.warn('Skipping non-matching URL in delete', { url });
          return;
        }

        const path = url.replace(bucketUrlPrefix, '');
        await this.bucket.file(path).delete();

        this.log.debug('File deleted', { path });
      } catch (error) {
        // Ignore errors (file may already be deleted)
        this.log.debug('Delete failed (may already be deleted)', {
          url,
          error: (error as Error).message,
        });
      }
    });

    await Promise.all(deletePromises);

    const duration = Date.now() - startTime;
    this.log.info('Batch delete completed', {
      count: gcsUrls.length,
      duration,
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Normalize content type by removing charset and other parameters
   */
  private normalizeContentType(contentType: string): string {
    return contentType.split(';')[0]?.trim().toLowerCase() || 'image/png';
  }

  /**
   * Safely extract hostname from URL for logging
   */
  private getUrlHost(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let instance: GCSStorageService | null = null;

/**
 * Get the singleton GCSStorageService instance.
 * Creates the instance on first call.
 *
 * @returns GCSStorageService instance
 */
export function getGCSStorageService(): GCSStorageService {
  if (!instance) {
    ensureGcsCredentials();
    const storage = new Storage();
    const bucketName = process.env.GCS_BUCKET_NAME?.trim();

    if (!bucketName) {
      throw new Error('Missing required env var: GCS_BUCKET_NAME');
    }

    const bucket = storage.bucket(bucketName);
    instance = new GCSStorageService(bucket);
  }

  return instance;
}

/**
 * Create a GCSStorageService with a custom bucket.
 * Useful for testing or using different buckets.
 *
 * @param bucket - GCS Bucket instance
 * @returns New GCSStorageService instance
 */
export function createGCSStorageService(bucket: Bucket): GCSStorageService {
  return new GCSStorageService(bucket);
}

export default GCSStorageService;
