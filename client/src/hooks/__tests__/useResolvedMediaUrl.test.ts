import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveMediaUrl } = vi.hoisted(() => ({
  mockResolveMediaUrl: vi.fn(),
}));

vi.mock('@/services/media/MediaUrlResolver', () => ({
  resolveMediaUrl: mockResolveMediaUrl,
}));

import { useResolvedMediaUrl } from '../useResolvedMediaUrl';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useResolvedMediaUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-refreshes on mount and stores resolved URL metadata', async () => {
    mockResolveMediaUrl.mockResolvedValue({
      url: 'https://signed.example/media.png',
      expiresAt: '2026-01-01T00:00:00.000Z',
      source: 'storage',
    });

    const { result } = renderHook(() =>
      useResolvedMediaUrl({
        kind: 'image',
        url: 'https://raw.example/media.png',
        storagePath: 'users/u1/images/media.png',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.url).toBe('https://signed.example/media.png');
      expect(result.current.expiresAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.current.error).toBeNull();
    });

    expect(mockResolveMediaUrl).toHaveBeenCalledWith({
      kind: 'image',
      url: 'https://raw.example/media.png',
      storagePath: 'users/u1/images/media.png',
      assetId: null,
      preferFresh: true,
    });
  });

  it('suppresses stale async updates when a newer request supersedes an older one', async () => {
    const first = createDeferred<{ url: string; source: 'storage' }>();
    const second = createDeferred<{ url: string; source: 'storage' }>();

    mockResolveMediaUrl
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ url }: { url: string }) =>
        useResolvedMediaUrl({
          kind: 'image',
          url,
          storagePath: 'users/u1/path.png',
        }),
      {
        initialProps: { url: 'https://raw.example/first.png' },
      }
    );

    rerender({ url: 'https://raw.example/second.png' });

    await act(async () => {
      second.resolve({ url: 'https://signed.example/second.png', source: 'storage' });
      await Promise.resolve();
    });

    expect(result.current.url).toBe('https://signed.example/second.png');

    await act(async () => {
      first.resolve({ url: 'https://signed.example/first.png', source: 'storage' });
      await Promise.resolve();
    });

    expect(result.current.url).toBe('https://signed.example/second.png');
  });

  it('returns fallback URL and sets error when resolver fails', async () => {
    mockResolveMediaUrl.mockRejectedValue(new Error('Resolver unavailable'));

    const { result } = renderHook(() =>
      useResolvedMediaUrl({
        kind: 'video',
        url: 'https://raw.example/video.mp4',
        assetId: 'asset-1',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Resolver unavailable');
      expect(result.current.url).toBe('https://raw.example/video.mp4');
    });

    await act(async () => {
      const refreshResult = await result.current.refresh('manual');
      expect(refreshResult).toEqual({
        url: 'https://raw.example/video.mp4',
        source: 'unknown',
      });
    });
  });

  it('does not auto-refresh when disabled but manual refresh still works', async () => {
    mockResolveMediaUrl.mockResolvedValue({
      url: 'https://signed.example/manual.png',
      source: 'storage',
    });

    const { result } = renderHook(() =>
      useResolvedMediaUrl({
        kind: 'image',
        url: 'https://raw.example/manual.png',
        enabled: false,
      })
    );

    expect(mockResolveMediaUrl).not.toHaveBeenCalled();
    expect(result.current.url).toBe('https://raw.example/manual.png');

    await act(async () => {
      await result.current.refresh('manual');
    });

    expect(mockResolveMediaUrl).toHaveBeenCalledTimes(1);
    expect(result.current.url).toBe('https://signed.example/manual.png');
  });
});
