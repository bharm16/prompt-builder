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

describe('MediaUrlResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves user storage paths via storage API', async () => {
    (storageApi.getViewUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      viewUrl: 'https://storage.example.com/users/user123/preview.webp',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      storagePath: 'users/user123/previews/images/preview.webp',
    });

    const result = await resolveMediaUrl({
      kind: 'image',
      storagePath: 'users/user123/previews/images/preview.webp',
    });

    expect(storageApi.getViewUrl).toHaveBeenCalledWith(
      'users/user123/previews/images/preview.webp'
    );
    expect(result.url).toBe('https://storage.example.com/users/user123/preview.webp');
    expect(result.source).toBe('storage');
    expect(result.storagePath).toBe('users/user123/previews/images/preview.webp');
  });

  it('refreshes expired signed URLs via preview asset view', async () => {
    (getVideoAssetViewUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        viewUrl: 'https://storage.example.com/video-previews/asset-123',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        assetId: 'asset-123',
        source: 'preview',
      },
    });

    const expiredUrl =
      'https://storage.googleapis.com/vidra-media-prod/video-previews/asset-123?GoogleAccessId=test&Expires=1&Signature=deadbeef';

    const result = await resolveMediaUrl({
      kind: 'video',
      url: expiredUrl,
    });

    expect(getVideoAssetViewUrl).toHaveBeenCalledWith('asset-123');
    expect(result.url).toBe('https://storage.example.com/video-previews/asset-123');
    expect(result.source).toBe('preview');
  });

  it('returns raw URL when not expired and preferFresh is false', async () => {
    const freshUrl =
      'https://storage.googleapis.com/vidra-media-prod/image-previews/asset-999?GoogleAccessId=test&Expires=4102444800&Signature=deadbeef';

    const result = await resolveMediaUrl({
      kind: 'image',
      url: freshUrl,
      preferFresh: false,
    });

    expect(getImageAssetViewUrl).not.toHaveBeenCalled();
    expect(result.url).toBe(freshUrl);
    expect(result.source).toBe('raw');
  });
});
