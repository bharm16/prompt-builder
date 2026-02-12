import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchImageAsDataUrl } from '../fetchImageAsDataUrl';

describe('fetchImageAsDataUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a base64 data URL for a valid image', async () => {
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.resolve(imageBytes.buffer),
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    const result = await fetchImageAsDataUrl('https://example.com/image.png');

    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/image.png',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('throws when the response is not ok', async () => {
    const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    await expect(fetchImageAsDataUrl('https://example.com/missing.png')).rejects.toThrow(
      'Image fetch failed: 404 Not Found'
    );
  });

  it('throws when image exceeds max byte limit', async () => {
    const largeBuffer = new ArrayBuffer(100);
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(largeBuffer),
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    await expect(
      fetchImageAsDataUrl('https://example.com/huge.jpg', { maxBytes: 50 })
    ).rejects.toThrow(/too large/);
  });

  it('defaults content type to image/png when header is missing', async () => {
    const imageBytes = new Uint8Array([0xff, 0xd8]);
    const mockResponse = {
      ok: true,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(imageBytes.buffer),
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    const result = await fetchImageAsDataUrl('https://example.com/image');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});
