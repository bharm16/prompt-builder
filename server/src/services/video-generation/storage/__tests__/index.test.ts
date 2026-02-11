import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  constructorArgs: [] as Array<{
    bucketName: string;
    basePath: string;
    signedUrlTtlMs: number;
    cacheControl: string;
  }>,
}));

vi.mock(
  '@infrastructure/Logger',
  () => ({
    logger: {
      info: mocks.loggerInfo,
      warn: mocks.loggerWarn,
    },
  })
);

vi.mock('../GcsVideoAssetStore', () => ({
  GcsVideoAssetStore: vi.fn().mockImplementation((options) => {
    mocks.constructorArgs.push(options);
    return {
      storeFromBuffer: vi.fn(),
      storeFromStream: vi.fn(),
      getStream: vi.fn(),
      getPublicUrl: vi.fn(),
      cleanupExpired: vi.fn(),
    };
  }),
}));

import { createVideoAssetStore } from '../index';

describe('createVideoAssetStore', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VIDEO_STORAGE_PROVIDER;
    delete process.env.VIDEO_STORAGE_BUCKET;
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.VIDEO_STORAGE_SIGNED_URL_TTL_SECONDS;
    delete process.env.VIDEO_STORAGE_BASE_PATH;
    delete process.env.VIDEO_STORAGE_CACHE_CONTROL;
    mocks.constructorArgs.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws for unsupported storage providers', () => {
    process.env.VIDEO_STORAGE_PROVIDER = 'local';
    process.env.VIDEO_STORAGE_BUCKET = 'my-bucket';

    expect(() => createVideoAssetStore()).toThrow(
      'Unsupported VIDEO_STORAGE_PROVIDER: local. Only "gcs" is supported.'
    );
  });

  it('throws when no bucket env is configured', () => {
    expect(() => createVideoAssetStore()).toThrow(
      'Missing required env var for video storage: VIDEO_STORAGE_BUCKET (or GCS_BUCKET_NAME)'
    );
  });

  it('normalizes gs bucket names and uses default options', () => {
    process.env.VIDEO_STORAGE_BUCKET = 'gs://video-bucket';

    createVideoAssetStore();

    expect(mocks.constructorArgs).toEqual([
      {
        bucketName: 'video-bucket',
        basePath: 'video-previews',
        signedUrlTtlMs: 3_600_000,
        cacheControl: 'public, max-age=86400',
      },
    ]);
    expect(mocks.loggerWarn).toHaveBeenCalledWith('Normalized GCS bucket name for video storage', {
      original: 'gs://video-bucket',
      bucketName: 'video-bucket',
    });
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Using GCS video storage', {
      bucketName: 'video-bucket',
      basePath: 'video-previews',
    });
  });

  it('uses GCS_BUCKET_NAME fallback and respects explicit storage env overrides', () => {
    process.env.GCS_BUCKET_NAME = 'fallback-bucket';
    process.env.VIDEO_STORAGE_SIGNED_URL_TTL_SECONDS = '120';
    process.env.VIDEO_STORAGE_BASE_PATH = 'custom-videos';
    process.env.VIDEO_STORAGE_CACHE_CONTROL = 'private, max-age=30';

    createVideoAssetStore();

    expect(mocks.constructorArgs).toEqual([
      {
        bucketName: 'fallback-bucket',
        basePath: 'custom-videos',
        signedUrlTtlMs: 120_000,
        cacheControl: 'private, max-age=30',
      },
    ]);
  });
});
