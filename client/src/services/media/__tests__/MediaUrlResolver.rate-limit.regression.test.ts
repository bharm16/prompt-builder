import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveMediaUrl } from '../MediaUrlResolver';
import { storageApi } from '@/api/storageApi';
import { getImageAssetViewUrl, getVideoAssetViewUrl } from '@/features/preview/api/previewApi';

vi.mock('@/api/storageApi', () => ({
  storageApi: {
    getViewUrl: vi.fn(),
  },
}));

vi.mock('@/features/preview/api/previewApi', () => ({
  getImageAssetViewUrl: vi.fn(),
  getVideoAssetViewUrl: vi.fn(),
}));

describe('regression: media URL resolver retries after transient rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not cache 429 failures for preview asset resolution', async () => {
    const rateLimitedError = Object.assign(new Error('Too many requests'), { status: 429 });

    (getImageAssetViewUrl as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(rateLimitedError)
      .mockResolvedValueOnce({
        success: true,
        data: {
          viewUrl: 'https://storage.example.com/image-previews/asset-429',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          assetId: 'asset-429',
        },
      });

    await expect(
      resolveMediaUrl({
        kind: 'image',
        assetId: 'asset-429',
      })
    ).rejects.toMatchObject({ status: 429 });

    const result = await resolveMediaUrl({
      kind: 'image',
      assetId: 'asset-429',
    });

    expect(storageApi.getViewUrl).not.toHaveBeenCalled();
    expect(getVideoAssetViewUrl).not.toHaveBeenCalled();
    expect(getImageAssetViewUrl).toHaveBeenCalledTimes(2);
    expect(result.url).toBe('https://storage.example.com/image-previews/asset-429');
    expect(result.source).toBe('preview');
  });
});
