import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAsVeoInline, MAX_IMAGE_BYTES } from '../imageUtils';

describe('fetchAsVeoInline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('converts fetched image body to base64 and preserves allowed mime type', async () => {
    const body = Buffer.from('hello-image');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (key: string) => (key === 'content-type' ? 'image/png' : null) },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAsVeoInline('https://example.com/image.png', 'image');

    expect(result.inlineData.mimeType).toBe('image/png');
    expect(result.inlineData.data).toBe(body.toString('base64'));
  });

  it('falls back to image/png for unknown image content-type', async () => {
    const body = Buffer.from('image-content');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html; charset=utf-8' },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAsVeoInline('https://example.com/image', 'image');

    expect(result.inlineData.mimeType).toBe('image/png');
    expect(result.inlineData.data).toBe(body.toString('base64'));
  });

  it('falls back to video/mp4 for unknown video content-type', async () => {
    const body = Buffer.from('video-content');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/octet-stream' },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAsVeoInline('https://example.com/video', 'video');

    expect(result.inlineData.mimeType).toBe('video/mp4');
    expect(result.inlineData.data).toBe(body.toString('base64'));
  });

  it('throws on non-OK fetch responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAsVeoInline('https://example.com/missing.png', 'image')).rejects.toThrow(
      'HTTP 404'
    );
  });

  it('throws when image payload exceeds max size', async () => {
    const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => oversized.buffer,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAsVeoInline('https://example.com/huge.jpg', 'image')).rejects.toThrow(
      'exceeds 20MB limit'
    );
  });
});
