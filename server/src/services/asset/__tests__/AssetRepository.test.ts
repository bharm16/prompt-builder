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
});
