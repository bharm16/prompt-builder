import { v4 as uuidv4 } from 'uuid';
import type { Bucket } from '@google-cloud/storage';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import { ReferenceImageService as ReferenceImageProcessor } from '@services/asset/ReferenceImageService';

interface ReferenceImageServiceOptions {
  db?: FirebaseFirestore.Firestore;
  bucket?: Bucket;
  bucketName?: string;
  processor?: ReferenceImageProcessor;
}

export interface ReferenceImageMetadata {
  width: number;
  height: number;
  sizeBytes: number;
  contentType: string;
  source?: string | null;
  originalName?: string | null;
}

export interface ReferenceImageRecord {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailPath: string;
  label?: string | null;
  metadata: ReferenceImageMetadata;
  createdAt: string;
  updatedAt: string;
}

interface CreateReferenceImageInput {
  label?: string | null;
  source?: string | null;
  originalName?: string | null;
}

function normalizeBucketName(raw: string): string {
  let bucketName = raw.trim();
  if (!bucketName) {
    throw new Error('Storage bucket name is required');
  }

  if (bucketName.startsWith('gs://')) {
    bucketName = bucketName.slice(5);
  }

  if (bucketName.startsWith('http://') || bucketName.startsWith('https://')) {
    try {
      const parsed = new URL(bucketName);
      if (parsed.hostname === 'firebasestorage.googleapis.com') {
        const match = parsed.pathname.match(/\/b\/([^/]+)\/o/);
        if (match?.[1]) bucketName = match[1];
      } else if (parsed.hostname === 'storage.googleapis.com') {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts[0]) bucketName = pathParts[0];
      } else {
        bucketName = parsed.hostname;
      }
    } catch {
      // Keep original string if URL parsing fails.
    }
  }

  bucketName = bucketName.replace(/^\/+/, '').split(/[/?#]/)[0] || '';
  if (bucketName.endsWith('.firebasestorage.app')) {
    bucketName = bucketName.replace(/\.firebasestorage\.app$/, '.appspot.com');
  }

  if (!bucketName) {
    throw new Error('Storage bucket name is required');
  }

  return bucketName;
}

function resolveBucketName(explicit?: string): string {
  const envBucket =
    explicit ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.GCS_BUCKET_NAME;
  if (!envBucket) {
    throw new Error(
      'Missing storage bucket config: VITE_FIREBASE_STORAGE_BUCKET or GCS_BUCKET_NAME'
    );
  }
  return normalizeBucketName(envBucket);
}

function buildDownloadUrl(bucketName: string, storagePath: string, token: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}

function getUrlHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export class ReferenceImageService {
  private readonly db: FirebaseFirestore.Firestore;
  private readonly bucket: Bucket;
  private readonly bucketName: string;
  private readonly processor: ReferenceImageProcessor;
  private readonly log = logger.child({ service: 'ReferenceImageService' });

  constructor(options: ReferenceImageServiceOptions = {}) {
    this.db = options.db || getFirestore();
    this.bucketName = resolveBucketName(options.bucketName);
    this.bucket = options.bucket || admin.storage().bucket(this.bucketName);
    this.processor = options.processor || new ReferenceImageProcessor();
  }

  private collection(userId: string): FirebaseFirestore.CollectionReference {
    return this.db.collection('users').doc(userId).collection('referenceImages');
  }

  async listImages(
    userId: string,
    options: { limit?: number } = {}
  ): Promise<ReferenceImageRecord[]> {
    const limit =
      typeof options.limit === 'number' && Number.isFinite(options.limit)
        ? Math.max(1, Math.min(options.limit, 200))
        : 50;
    const snapshot = await this.collection(userId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as ReferenceImageRecord;
      return { ...data, id: data.id || doc.id };
    });
  }

  async createFromBuffer(
    userId: string,
    buffer: Buffer,
    input: CreateReferenceImageInput = {}
  ): Promise<ReferenceImageRecord> {
    const operation = 'createFromBuffer';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      bufferSize: buffer.length,
      hasLabel: Boolean(input.label),
      hasSource: Boolean(input.source),
      hasOriginalName: Boolean(input.originalName),
    });

    const imageId = `ref_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const storagePath = `users/${userId}/reference-images/${imageId}.jpg`;
    const thumbnailPath = `users/${userId}/reference-images/${imageId}_thumb.jpg`;

    try {
      const processedImage = await this.processor.processImage(buffer);
      const thumbnail = await this.processor.generateThumbnail(processedImage.buffer);

      const imageToken = uuidv4();
      const thumbnailToken = uuidv4();

      await this.bucket.file(storagePath).save(processedImage.buffer, {
        resumable: false,
        contentType: 'image/jpeg',
        metadata: {
          cacheControl: 'public, max-age=31536000',
          metadata: {
            firebaseStorageDownloadTokens: imageToken,
          },
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      });

      await this.bucket.file(thumbnailPath).save(thumbnail.buffer, {
        resumable: false,
        contentType: 'image/jpeg',
        metadata: {
          cacheControl: 'public, max-age=31536000',
          metadata: {
            firebaseStorageDownloadTokens: thumbnailToken,
          },
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      });

      const now = new Date().toISOString();
      const record: ReferenceImageRecord = {
        id: imageId,
        userId,
        imageUrl: buildDownloadUrl(this.bucketName, storagePath, imageToken),
        thumbnailUrl: buildDownloadUrl(this.bucketName, thumbnailPath, thumbnailToken),
        storagePath,
        thumbnailPath,
        label: input.label ?? null,
        metadata: {
          width: processedImage.width,
          height: processedImage.height,
          sizeBytes: processedImage.sizeBytes,
          contentType: 'image/jpeg',
          source: input.source ?? null,
          originalName: input.originalName ?? null,
        },
        createdAt: now,
        updatedAt: now,
      };

      await this.collection(userId).doc(imageId).set(record);

      this.log.info('Operation completed.', {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
        imageId,
        storagePath,
        thumbnailPath,
        sizeBytes: processedImage.sizeBytes,
        width: processedImage.width,
        height: processedImage.height,
      });

      return record;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async createFromUrl(
    userId: string,
    sourceUrl: string,
    input: CreateReferenceImageInput = {}
  ): Promise<ReferenceImageRecord> {
    const operation = 'createFromUrl';
    const sourceHost = getUrlHost(sourceUrl);
    this.log.debug('Fetching reference image.', {
      operation,
      userId,
      ...(sourceHost ? { sourceHost } : {}),
    });

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      this.log.warn('Failed to fetch reference image.', {
        operation,
        userId,
        status: response.status,
        statusText: response.statusText,
        ...(sourceHost ? { sourceHost } : {}),
      });
      throw new Error(`Failed to fetch reference image: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return await this.createFromBuffer(userId, buffer, {
      ...input,
      source: input.source ?? 'url',
    });
  }

  async deleteImage(userId: string, imageId: string): Promise<boolean> {
    const operation = 'deleteImage';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, imageId });

    const docRef = this.collection(userId).doc(imageId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      this.log.info('Operation completed.', {
        operation,
        userId,
        imageId,
        duration: Math.round(performance.now() - startTime),
        deleted: false,
        reason: 'not_found',
      });
      return false;
    }

    const data = snapshot.data() as ReferenceImageRecord | undefined;
    const paths = [data?.storagePath, data?.thumbnailPath].filter(
      (path): path is string => typeof path === 'string' && path.length > 0
    );

    let failedDeletes = 0;
    for (const path of paths) {
      try {
        await this.bucket.file(path).delete();
      } catch (error) {
        failedDeletes += 1;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log.warn('Failed to delete reference image from storage', {
          operation,
          userId,
          imageId,
          path,
          error: errorMessage,
        });
      }
    }

    await docRef.delete();
    this.log.info('Operation completed.', {
      operation,
      userId,
      imageId,
      duration: Math.round(performance.now() - startTime),
      deleted: true,
      deletedPaths: paths.length - failedDeletes,
      failedDeletes,
    });
    return true;
  }
}

export default ReferenceImageService;
