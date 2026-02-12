import { v4 as uuidv4 } from 'uuid';
import type { Bucket } from '@google-cloud/storage';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import type { Asset, AssetReferenceImage, AssetType } from '@shared/types/asset';

interface AssetRepositoryOptions {
  db?: FirebaseFirestore.Firestore;
  bucket?: Bucket;
  bucketName?: string;
  bucketFactory?: (bucketName: string) => Bucket;
}

export interface ReferenceImageMetadataInput {
  angle?: AssetReferenceImage['metadata']['angle'];
  expression?: AssetReferenceImage['metadata']['expression'];
  styleType?: AssetReferenceImage['metadata']['styleType'];
  timeOfDay?: AssetReferenceImage['metadata']['timeOfDay'];
  lighting?: AssetReferenceImage['metadata']['lighting'];
  width?: number;
  height?: number;
}

export interface ProcessedImageInput {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  format?: string;
}

const MAX_IN_QUERY = 10;

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

function resolveBucketCandidates(explicit?: string): string[] {
  const rawBuckets = [
    explicit,
    process.env.ASSET_STORAGE_BUCKET,
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.GCS_BUCKET_NAME,
    process.env.VITE_FIREBASE_STORAGE_BUCKET,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (!rawBuckets.length) {
    throw new Error(
      'Missing storage bucket config: ASSET_STORAGE_BUCKET, FIREBASE_STORAGE_BUCKET, GCS_BUCKET_NAME, or VITE_FIREBASE_STORAGE_BUCKET'
    );
  }

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const rawBucket of rawBuckets) {
    const normalized = normalizeBucketName(rawBucket);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

function isBucketNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const withCode = error as { code?: unknown };
  if (withCode.code === 404 || withCode.code === '404') {
    return true;
  }

  const withErrors = error as { errors?: Array<{ reason?: string }> };
  return (
    Array.isArray(withErrors.errors) &&
    withErrors.errors.some((entry) => entry?.reason === 'notFound')
  );
}

function buildDownloadUrl(bucketName: string, storagePath: string, token: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}

/**
 * Extract the token from a Firebase Storage download URL
 */
function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

/**
 * Extract the bucket name from a Firebase Storage download URL
 * Returns null if URL doesn't match expected Firebase Storage format
 */
function extractBucketFromUrl(url: string): string | null {
  try {
    // Match Firebase Storage URL pattern: firebasestorage.googleapis.com/v0/b/{bucket}/o/
    const match = url.match(/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\//);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a URL appears to be a valid Firebase Storage download URL
 */
function isValidFirebaseStorageUrl(url: string): boolean {
  const bucket = extractBucketFromUrl(url);
  const token = extractTokenFromUrl(url);
  // Valid if we can extract both bucket and token
  return bucket !== null && token !== null;
}

/**
 * Refresh a reference image's URLs only if they are malformed
 *
 * IMPORTANT: We preserve URLs that already point to valid buckets (even if different
 * from the current bucket), because files may be stored in different buckets
 * (e.g., Firebase Storage vs GCS bucket).
 */
function refreshImageUrls(
  image: AssetReferenceImage,
  bucketName: string
): AssetReferenceImage {
  // If we don't have storage paths, we can't refresh
  if (!image.storagePath) {
    return image;
  }

  // If the URL is already a valid Firebase Storage URL (regardless of which bucket),
  // preserve it as-is. The files exist in their original bucket.
  if (isValidFirebaseStorageUrl(image.url)) {
    return image;
  }

  // Only refresh if URL is malformed or missing expected components
  const imageToken = extractTokenFromUrl(image.url);
  const thumbToken = image.thumbnailUrl ? extractTokenFromUrl(image.thumbnailUrl) : null;

  // If we can't extract tokens, return as-is
  if (!imageToken) {
    return image;
  }

  return {
    ...image,
    url: buildDownloadUrl(bucketName, image.storagePath, imageToken),
    thumbnailUrl: image.thumbnailPath && thumbToken
      ? buildDownloadUrl(bucketName, image.thumbnailPath, thumbToken)
      : image.thumbnailUrl,
  };
}

/**
 * Refresh all reference image URLs in an asset to use the current bucket
 */
function refreshAssetUrls(asset: Asset, bucketName: string): Asset {
  if (!asset.referenceImages?.length) {
    return asset;
  }

  return {
    ...asset,
    referenceImages: asset.referenceImages.map((img) => refreshImageUrls(img, bucketName)),
  };
}

export class AssetRepository {
  private readonly db: FirebaseFirestore.Firestore;
  private readonly bucket: Bucket;
  private readonly bucketName: string;
  private readonly bucketCandidates: string[];
  private readonly bucketFactory: (bucketName: string) => Bucket;
  private readonly bucketCache = new Map<string, Bucket>();
  private readonly log = logger.child({ service: 'AssetRepository' });

  constructor(options: AssetRepositoryOptions = {}) {
    this.db = options.db || getFirestore();
    this.bucketCandidates = resolveBucketCandidates(options.bucketName);
    this.bucketName = this.bucketCandidates[0]!;
    this.bucketFactory = options.bucketFactory || ((bucketName: string) => admin.storage().bucket(bucketName));
    this.bucket = options.bucket || this.bucketFactory(this.bucketName);
    this.bucketCache.set(this.bucketName, this.bucket);
  }

  private getBucketByName(bucketName: string): Bucket {
    const cached = this.bucketCache.get(bucketName);
    if (cached) {
      return cached;
    }

    const bucket = this.bucketFactory(bucketName);
    this.bucketCache.set(bucketName, bucket);
    return bucket;
  }

  private getAssetsCollection(userId: string): FirebaseFirestore.CollectionReference {
    return this.db.collection('users').doc(userId).collection('assets');
  }

  private getAssetDoc(userId: string, assetId: string): FirebaseFirestore.DocumentReference {
    return this.getAssetsCollection(userId).doc(assetId);
  }

  private getUsageCollection(userId: string): FirebaseFirestore.CollectionReference {
    return this.db.collection('users').doc(userId).collection('assetUsage');
  }

  async create(userId: string, assetData: {
    type: AssetType;
    trigger: string;
    name: string;
    textDefinition: string;
    negativePrompt?: string;
  }): Promise<Asset> {
    const operation = 'create';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      type: assetData.type,
      triggerLength: assetData.trigger.length,
      nameLength: assetData.name.length,
    });

    const assetId = `asset_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    const asset: Asset = {
      id: assetId,
      userId,
      type: assetData.type,
      trigger: assetData.trigger.toLowerCase(),
      name: assetData.name,
      textDefinition: assetData.textDefinition || '',
      negativePrompt: assetData.negativePrompt || '',
      referenceImages: [],
      faceEmbedding: null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.getAssetDoc(userId, assetId).set(asset);
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        type: asset.type,
        duration: Math.round(performance.now() - startTime),
      });
      return asset;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async getById(userId: string, assetId: string): Promise<Asset | null> {
    const snapshot = await this.getAssetDoc(userId, assetId).get();
    if (!snapshot.exists) {
      return null;
    }
    const asset = snapshot.data() as Asset;
    return refreshAssetUrls(asset, this.bucketName);
  }

  async getByTrigger(userId: string, trigger: string): Promise<Asset | null> {
    const normalized = trigger.toLowerCase();
    const snapshot = await this.getAssetsCollection(userId)
      .where('trigger', '==', normalized)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const asset = snapshot.docs[0]?.data() as Asset | undefined;
    return asset ? refreshAssetUrls(asset, this.bucketName) : null;
  }

  async getByTriggers(userId: string, triggers: string[]): Promise<Asset[]> {
    if (!triggers.length) return [];

    const normalizedTriggers = triggers.map((t) => t.toLowerCase());
    const batches: string[][] = [];
    for (let i = 0; i < normalizedTriggers.length; i += MAX_IN_QUERY) {
      batches.push(normalizedTriggers.slice(i, i + MAX_IN_QUERY));
    }

    const results: Asset[] = [];
    for (const batch of batches) {
      const snapshot = await this.getAssetsCollection(userId)
        .where('trigger', 'in', batch)
        .get();
      results.push(
        ...snapshot.docs.map((doc) => refreshAssetUrls(doc.data() as Asset, this.bucketName))
      );
    }

    return results;
  }

  async getAll(
    userId: string,
    options: { limit?: number; orderByField?: string; type?: AssetType | null } = {}
  ): Promise<Asset[]> {
    const { limit: maxResults = 100, orderByField = 'updatedAt', type = null } = options;

    let query = this.getAssetsCollection(userId)
      .orderBy(orderByField, 'desc')
      .limit(maxResults);

    if (type) {
      query = this.getAssetsCollection(userId)
        .where('type', '==', type)
        .orderBy(orderByField, 'desc')
        .limit(maxResults);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => refreshAssetUrls(doc.data() as Asset, this.bucketName));
  }

  async getByType(userId: string, type: AssetType): Promise<Asset[]> {
    const snapshot = await this.getAssetsCollection(userId)
      .where('type', '==', type)
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => refreshAssetUrls(doc.data() as Asset, this.bucketName));
  }

  async update(
    userId: string,
    assetId: string,
    updates: Partial<Asset>
  ): Promise<Asset | null> {
    const operation = 'update';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      assetId,
      updateKeys: Object.keys(updates),
    });

    const updateData: Partial<Asset> & { updatedAt: string } = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    delete updateData.id;
    delete updateData.userId;
    delete updateData.type;
    delete updateData.createdAt;

    try {
      await this.getAssetDoc(userId, assetId).update(updateData);
      const updated = await this.getById(userId, assetId);
      this.log.debug('Operation completed.', {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      return updated;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async incrementUsage(userId: string, assetId: string): Promise<void> {
    const operation = 'incrementUsage';
    const startTime = performance.now();
    const now = new Date().toISOString();
    try {
      await this.getAssetDoc(userId, assetId).update({
        usageCount: admin.firestore.FieldValue.increment(1),
        lastUsedAt: now,
        updatedAt: now,
      });
      this.log.debug('Operation completed.', {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async delete(userId: string, assetId: string): Promise<boolean> {
    const operation = 'delete';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId });

    try {
      const asset = await this.getById(userId, assetId);
      if (asset?.referenceImages?.length) {
        for (const image of asset.referenceImages) {
          await this.deleteReferenceImage(userId, assetId, image.id);
        }
      }

      await this.getAssetDoc(userId, assetId).delete();
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async addReferenceImage(
    userId: string,
    assetId: string,
    image: ProcessedImageInput,
    thumbnail: ProcessedImageInput,
    metadata: ReferenceImageMetadataInput
  ): Promise<AssetReferenceImage> {
    const operation = 'addReferenceImage';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      assetId,
      imageSize: image.sizeBytes,
      thumbnailSize: thumbnail.sizeBytes,
    });

    const imageId = `img_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
    const storagePath = `users/${userId}/assets/${assetId}/${imageId}.jpg`;
    const thumbnailPath = `users/${userId}/assets/${assetId}/${imageId}_thumb.jpg`;

    const imageToken = uuidv4();
    const thumbnailToken = uuidv4();

    try {
      let resolvedBucketName: string | null = null;
      let lastError: unknown = null;
      const fallbackBuckets = this.bucketCandidates.filter((candidate) => candidate !== this.bucketName);
      const uploadBuckets = [this.bucketName, ...fallbackBuckets];

      for (const candidateBucket of uploadBuckets) {
        const candidateBucketClient = this.getBucketByName(candidateBucket);
        try {
          await candidateBucketClient.file(storagePath).save(image.buffer, {
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

          try {
            await candidateBucketClient.file(thumbnailPath).save(thumbnail.buffer, {
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
          } catch (thumbnailError) {
            await candidateBucketClient.file(storagePath).delete().catch(() => undefined);
            throw thumbnailError;
          }

          resolvedBucketName = candidateBucket;
          break;
        } catch (uploadError) {
          lastError = uploadError;
          const hasFallback = candidateBucket !== uploadBuckets[uploadBuckets.length - 1];
          if (!isBucketNotFoundError(uploadError) || !hasFallback) {
            throw uploadError;
          }

          const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
          this.log.warn('Primary asset bucket not found, trying fallback bucket', {
            operation,
            userId,
            assetId,
            failedBucket: candidateBucket,
            nextBucket: uploadBuckets[uploadBuckets.indexOf(candidateBucket) + 1],
            error: errorMessage,
          });
        }
      }

      if (!resolvedBucketName) {
        throw lastError instanceof Error ? lastError : new Error('Failed to upload asset image');
      }

      const referenceImage: AssetReferenceImage = {
        id: imageId,
        url: buildDownloadUrl(resolvedBucketName, storagePath, imageToken),
        thumbnailUrl: buildDownloadUrl(resolvedBucketName, thumbnailPath, thumbnailToken),
        isPrimary: false,
        storagePath,
        thumbnailPath,
        metadata: {
          angle: metadata.angle ?? null,
          expression: metadata.expression ?? null,
          styleType: metadata.styleType ?? null,
          timeOfDay: metadata.timeOfDay ?? null,
          lighting: metadata.lighting ?? null,
          uploadedAt: new Date().toISOString(),
          width: metadata.width ?? image.width,
          height: metadata.height ?? image.height,
          sizeBytes: image.sizeBytes ?? image.buffer.length,
        },
      };

      const asset = await this.getById(userId, assetId);
      const referenceImages = [...(asset?.referenceImages || []), referenceImage];

      if (referenceImages.length === 1) {
        referenceImages[0] = { ...referenceImages[0], isPrimary: true } as AssetReferenceImage;
      }

      await this.update(userId, assetId, { referenceImages });
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        imageId,
        duration: Math.round(performance.now() - startTime),
      });
      return referenceImage;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async deleteReferenceImage(userId: string, assetId: string, imageId: string): Promise<boolean> {
    const operation = 'deleteReferenceImage';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId, imageId });

    try {
      const asset = await this.getById(userId, assetId);
      if (!asset?.referenceImages?.length) return false;

      const image = asset.referenceImages.find((img) => img.id === imageId);
      if (!image) return false;

      const imageBucket = extractBucketFromUrl(image.url) || this.bucketName;
      const thumbnailBucket = extractBucketFromUrl(image.thumbnailUrl) || imageBucket;
      const storageTargets = [
        image.storagePath ? { path: image.storagePath, bucket: imageBucket } : null,
        image.thumbnailPath ? { path: image.thumbnailPath, bucket: thumbnailBucket } : null,
      ].filter((value): value is { path: string; bucket: string } => Boolean(value));

      for (const target of storageTargets) {
        try {
          await this.getBucketByName(target.bucket).file(target.path).delete();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.log.warn('Failed to delete asset image from storage', {
            operation,
            assetId,
            imageId,
            path: target.path,
            bucket: target.bucket,
            error: errorMessage,
          });
        }
      }

      const referenceImages = asset.referenceImages.filter((img) => img.id !== imageId);
      if (image.isPrimary && referenceImages.length > 0) {
        referenceImages[0] = { ...referenceImages[0], isPrimary: true } as AssetReferenceImage;
      }

      await this.update(userId, assetId, { referenceImages });
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        imageId,
        duration: Math.round(performance.now() - startTime),
      });
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        imageId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async setPrimaryImage(userId: string, assetId: string, imageId: string): Promise<Asset | null> {
    const operation = 'setPrimaryImage';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId, imageId });

    try {
      const asset = await this.getById(userId, assetId);
      if (!asset?.referenceImages?.length) return null;

      const referenceImages = asset.referenceImages.map((img) => ({
        ...img,
        isPrimary: img.id === imageId,
      }));

      await this.update(userId, assetId, { referenceImages });
      const updated = await this.getById(userId, assetId);
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        imageId,
        duration: Math.round(performance.now() - startTime),
      });
      return updated;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        imageId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async triggerExists(userId: string, trigger: string, excludeAssetId?: string | null): Promise<boolean> {
    const normalized = trigger.toLowerCase();
    const snapshot = await this.getAssetsCollection(userId)
      .where('trigger', '==', normalized)
      .limit(1)
      .get();
    if (snapshot.empty) return false;

    if (excludeAssetId) {
      return snapshot.docs[0]?.data()?.id !== excludeAssetId;
    }
    return true;
  }

  async createUsageRecord(userId: string, input: {
    assetId: string;
    assetType: AssetType;
    generationId?: string | null;
    promptText?: string | null;
    expandedText?: string | null;
  }): Promise<void> {
    const operation = 'createUsageRecord';
    const startTime = performance.now();
    const usageId = `usage_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    try {
      await this.getUsageCollection(userId).doc(usageId).set({
        id: usageId,
        assetId: input.assetId,
        assetType: input.assetType,
        generationId: input.generationId || null,
        promptText: input.promptText || '',
        expandedText: input.expandedText || '',
        createdAt: new Date().toISOString(),
      });
      this.log.debug('Operation completed.', {
        operation,
        userId,
        assetId: input.assetId,
        duration: Math.round(performance.now() - startTime),
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId: input.assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }
}

export default AssetRepository;
