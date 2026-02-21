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
    const bucket = { name: 'test-bucket', file: vi.fn() } as any;

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

  it('stores reference images in the injected bucket', async () => {
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
      get: vi
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => existingAsset })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            ...existingAsset,
            referenceImages: [
              {
                id: 'img_1234',
                url: 'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/foo',
                thumbnailUrl: 'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/bar',
                storagePath: 'users/user-1/assets/asset-1/img_1234.jpg',
                thumbnailPath: 'users/user-1/assets/asset-1/img_1234_thumb.jpg',
                isPrimary: true,
                metadata: {
                  angle: null,
                  expression: null,
                  styleType: null,
                  timeOfDay: null,
                  lighting: null,
                  uploadedAt: new Date().toISOString(),
                  width: 512,
                  height: 512,
                  sizeBytes: 5,
                },
              },
            ],
          }),
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

    const imageSave = vi.fn().mockResolvedValue(undefined);
    const thumbSave = vi.fn().mockResolvedValue(undefined);

    const bucket = {
      name: 'test-bucket',
      file: vi.fn((path: string) => {
        if (path.endsWith('_thumb.jpg')) {
          return { save: thumbSave, delete: vi.fn().mockResolvedValue(undefined) };
        }
        return { save: imageSave, delete: vi.fn().mockResolvedValue(undefined) };
      }),
    } as any;

    const repository = new AssetRepository({
      db,
      bucket,
      bucketName: 'test-bucket',
    });

    const result = await repository.addReferenceImage(
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
    );

    expect(imageSave).toHaveBeenCalledTimes(1);
    expect(thumbSave).toHaveBeenCalledTimes(1);
    expect(result.url).toContain('/b/test-bucket/o/');
    expect(result.thumbnailUrl).toContain('/b/test-bucket/o/');
  });
});
