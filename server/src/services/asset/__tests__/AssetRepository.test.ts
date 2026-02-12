import { describe, it, expect, vi } from 'vitest';
import AssetRepository from '../AssetRepository';

describe('AssetRepository', () => {
  it('normalizes trigger casing on create', async () => {
    const setMock = vi.fn();
    const assetDoc = { set: setMock };
    const assetsCollection = { doc: vi.fn(() => assetDoc) };
    const userDoc = { collection: vi.fn(() => assetsCollection) };
    const usersCollection = { doc: vi.fn(() => userDoc) };
    const db = { collection: vi.fn(() => usersCollection) } as any;
    const bucket = { file: vi.fn() } as any;

    const repository = new AssetRepository({ db, bucket, bucketName: 'test-bucket' });

    const asset = await repository.create('user-1', {
      type: 'character',
      trigger: '@Alice',
      name: 'Alice',
      textDefinition: 'Test description',
    });

    expect(asset.trigger).toBe('@alice');
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ trigger: '@alice' }));
  });

  it('falls back to an alternate bucket when the primary bucket does not exist', async () => {
    const originalGcsBucket = process.env.GCS_BUCKET_NAME;
    process.env.GCS_BUCKET_NAME = 'fallback-bucket';
    try {
      const existingAsset = {
        id: 'asset-1',
        userId: 'user-1',
        type: 'character',
        trigger: '@hero',
        name: 'Hero',
        textDefinition: '',
        negativePrompt: '',
        referenceImages: [],
        faceEmbedding: null,
        usageCount: 0,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const assetDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => existingAsset,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };
      const assetsCollection = { doc: vi.fn(() => assetDoc) };
      const userDoc = {
        collection: vi.fn((name: string) => {
          if (name === 'assets') return assetsCollection;
          if (name === 'assetUsage') return { doc: vi.fn(() => ({ set: vi.fn() })) };
          throw new Error(`Unexpected collection: ${name}`);
        }),
      };
      const usersCollection = { doc: vi.fn(() => userDoc) };
      const db = {
        collection: vi.fn((name: string) => {
          if (name === 'users') return usersCollection;
          throw new Error(`Unexpected top-level collection: ${name}`);
        }),
      } as any;

      const missingBucketError = {
        message: 'The specified bucket does not exist.',
        code: 404,
        errors: [{ reason: 'notFound' }],
      };

      const missingBucketSave = vi.fn().mockRejectedValue(missingBucketError);
      const fallbackBucketSave = vi.fn().mockResolvedValue(undefined);

      const primaryBucket = {
        file: vi.fn(() => ({
          save: missingBucketSave,
          delete: vi.fn().mockResolvedValue(undefined),
        })),
      } as any;

      const fallbackBucket = {
        file: vi.fn(() => ({
          save: fallbackBucketSave,
          delete: vi.fn().mockResolvedValue(undefined),
        })),
      } as any;

      const bucketFactory = vi.fn((bucketName: string) => {
        if (bucketName === 'missing-bucket') return primaryBucket;
        if (bucketName === 'fallback-bucket') return fallbackBucket;
        throw new Error(`Unexpected bucket: ${bucketName}`);
      });

      const repository = new AssetRepository({
        db,
        bucket: primaryBucket,
        bucketName: 'missing-bucket',
        bucketFactory,
      } as any);

      await expect(
        repository.addReferenceImage(
          'user-1',
          'asset-1',
          {
            buffer: Buffer.from('image'),
            width: 512,
            height: 512,
            sizeBytes: 5,
          },
          {
            buffer: Buffer.from('thumb'),
            width: 256,
            height: 256,
            sizeBytes: 5,
          },
          {}
        )
      ).resolves.toEqual(
        expect.objectContaining({
          url: expect.stringContaining('/b/fallback-bucket/o/'),
          thumbnailUrl: expect.stringContaining('/b/fallback-bucket/o/'),
        })
      );

      expect(missingBucketSave).toHaveBeenCalled();
      expect(fallbackBucketSave).toHaveBeenCalledTimes(2);
    } finally {
      process.env.GCS_BUCKET_NAME = originalGcsBucket;
    }
  });
});
