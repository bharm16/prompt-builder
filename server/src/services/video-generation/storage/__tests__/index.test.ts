import { beforeEach, describe, expect, it, vi } from 'vitest';

const constructorArgs: Array<{
  bucket: unknown;
  basePath: string;
  signedUrlTtlMs: number;
  cacheControl: string;
}> = [];

vi.mock('../GcsVideoAssetStore', () => ({
  GcsVideoAssetStore: vi.fn().mockImplementation((options) => {
    constructorArgs.push(options);
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
  const bucket = { file: vi.fn(), getFiles: vi.fn() } as never;

  beforeEach(() => {
    constructorArgs.length = 0;
    vi.clearAllMocks();
  });

  it('uses defaults with injected bucket', () => {
    createVideoAssetStore({ bucket });

    expect(constructorArgs).toEqual([
      {
        bucket,
        basePath: 'video-previews',
        signedUrlTtlMs: 3_600_000,
        cacheControl: 'public, max-age=86400',
      },
    ]);
  });

  it('respects explicit overrides', () => {
    createVideoAssetStore({
      bucket,
      basePath: 'custom-videos',
      signedUrlTtlMs: 120_000,
      cacheControl: 'private, max-age=30',
    });

    expect(constructorArgs).toEqual([
      {
        bucket,
        basePath: 'custom-videos',
        signedUrlTtlMs: 120_000,
        cacheControl: 'private, max-age=30',
      },
    ]);
  });
});
