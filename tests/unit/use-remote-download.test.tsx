import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useRemoteDownload } from '@features/preview/hooks/useRemoteDownload';

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useRemoteDownload', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalOpen = window.open;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:object-url');
    URL.revokeObjectURL = vi.fn();
    window.open = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.open = originalOpen;
  });

  describe('error handling', () => {
    it('opens a fallback tab when fetch rejects', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() => useRemoteDownload());

      await act(async () => {
        await result.current.download({ url: 'https://cdn/file.mp4', fileName: 'file.mp4' });
      });

      expect(window.open).toHaveBeenCalledWith('https://cdn/file.mp4', '_blank', 'noopener,noreferrer');
      expect(result.current.isDownloading).toBe(false);
    });

    it('opens a fallback tab when the response is not ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() => useRemoteDownload());

      await act(async () => {
        await result.current.download({ url: 'https://cdn/file.mp4', fileName: 'file.mp4' });
      });

      expect(window.open).toHaveBeenCalledWith('https://cdn/file.mp4', '_blank', 'noopener,noreferrer');
      expect(result.current.isDownloading).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('skips when the url is empty', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() => useRemoteDownload());

      await act(async () => {
        await result.current.download({ url: '', fileName: 'file.mp4' });
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.isDownloading).toBe(false);
    });

    it('prevents concurrent downloads while already in progress', async () => {
      const deferred = createDeferred<Response>();
      const fetchMock = vi.fn().mockReturnValue(deferred.promise);
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() => useRemoteDownload());

      act(() => {
        void result.current.download({ url: 'https://cdn/file.mp4', fileName: 'file.mp4' });
      });
      act(() => {
        void result.current.download({ url: 'https://cdn/another.mp4', fileName: 'another.mp4' });
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      deferred.resolve({ ok: true, blob: async () => new Blob(['data']) } as Response);

      await waitFor(() => expect(result.current.isDownloading).toBe(false));
    });
  });

  describe('core behavior', () => {
    it('creates a downloadable link and revokes it after success', async () => {
      const clickSpy = vi.fn();
      const anchor = document.createElement('a');
      anchor.click = clickSpy;

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['video-data']),
      });
      global.fetch = fetchMock as typeof fetch;

      const { result } = renderHook(() => useRemoteDownload());

      await act(async () => {
        await result.current.download({ url: 'https://cdn/file.mp4', fileName: 'video.mp4' });
      });

      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(anchor.download).toBe('video.mp4');
      expect(anchor.href).toBe('blob:object-url');
      expect(clickSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:object-url');
      expect(window.open).not.toHaveBeenCalled();

      createElementSpy.mockRestore();
    });
  });
});
