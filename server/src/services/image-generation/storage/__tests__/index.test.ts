import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as storageTypesModule from '../types';

const gcsCtor = vi.fn();

vi.mock('../GcsImageAssetStore', () => ({
  GcsImageAssetStore: vi.fn((options) => {
    gcsCtor(options);
    return { __options: options };
  }),
}));

const resetEnv = (originalEnv: NodeJS.ProcessEnv) => {
  process.env = { ...originalEnv };
};

describe('createImageAssetStore', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetEnv(originalEnv);
  });

  afterEach(() => {
    resetEnv(originalEnv);
  });

  describe('error handling', () => {
    it('throws for unsupported storage providers', async () => {
      process.env.IMAGE_STORAGE_PROVIDER = 'local';
      process.env.IMAGE_STORAGE_BUCKET = 'bucket';

      const { createImageAssetStore } = await import('../index');

      expect(() => createImageAssetStore()).toThrow(
        'Unsupported IMAGE_STORAGE_PROVIDER: local. Only "gcs" is supported.'
      );
    });

    it('throws when no bucket name is configured', async () => {
      delete process.env.IMAGE_STORAGE_BUCKET;
      delete process.env.GCS_BUCKET_NAME;

      const { createImageAssetStore } = await import('../index');

      expect(() => createImageAssetStore()).toThrow(
        'Missing required env var for image storage: IMAGE_STORAGE_BUCKET (or GCS_BUCKET_NAME)'
      );
    });

    it('throws when the configured bucket name is blank', async () => {
      process.env.IMAGE_STORAGE_BUCKET = '   ';

      const { createImageAssetStore } = await import('../index');

      expect(() => createImageAssetStore()).toThrow(
        'Missing required env var for image storage: IMAGE_STORAGE_BUCKET (or GCS_BUCKET_NAME)'
      );
    });
  });

  describe('edge cases', () => {
    it('keeps storage types as a type-only module at runtime', () => {
      expect(Object.keys(storageTypesModule)).toHaveLength(0);
    });

    it('normalizes gs:// bucket names', async () => {
      process.env.IMAGE_STORAGE_BUCKET = 'gs://my-image-bucket';

      const { createImageAssetStore } = await import('../index');
      const result = createImageAssetStore();

      expect(result).toEqual({ __options: expect.any(Object) });
      expect(gcsCtor).toHaveBeenCalledWith(
        expect.objectContaining({ bucketName: 'my-image-bucket' })
      );
    });

    it('extracts bucket names from Firebase storage URLs', async () => {
      process.env.IMAGE_STORAGE_BUCKET =
        'https://firebasestorage.googleapis.com/v0/b/mybucket.appspot.com/o';

      const { createImageAssetStore } = await import('../index');
      createImageAssetStore();

      expect(gcsCtor).toHaveBeenCalledWith(
        expect.objectContaining({ bucketName: 'mybucket.appspot.com' })
      );
    });
  });

  describe('core behavior', () => {
    it('uses configured TTL, base path, and cache control', async () => {
      process.env.IMAGE_STORAGE_BUCKET = 'my-bucket';
      process.env.IMAGE_STORAGE_SIGNED_URL_TTL_SECONDS = '120';
      process.env.IMAGE_STORAGE_BASE_PATH = 'custom-path';
      process.env.IMAGE_STORAGE_CACHE_CONTROL = 'public, max-age=120';

      const { createImageAssetStore } = await import('../index');
      createImageAssetStore();

      expect(gcsCtor).toHaveBeenCalledWith({
        bucketName: 'my-bucket',
        basePath: 'custom-path',
        signedUrlTtlMs: 120000,
        cacheControl: 'public, max-age=120',
      });
    });
  });
});
