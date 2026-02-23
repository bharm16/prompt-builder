import { Readable, Writable } from 'node:stream';
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import { VIDEO_MODELS } from '@config/modelConfig';
import { parseVideoPreviewRequest, sendVideoContent } from '../videoRequest';

class MockResponse extends Writable {
  public headers = new Map<string, string>();
  public chunks: Buffer[] = [];
  public headersSent = false;
  public destroyError: Error | null = null;

  public setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  override destroy(error?: Error): this {
    if (error) {
      this.destroyError = error;
    }
    return super.destroy(error);
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.headersSent = true;
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }
}

describe('video request parser regression', () => {
  it('rejects invalid aspect ratios', () => {
    const result = parseVideoPreviewRequest({
      prompt: 'Cinematic prompt',
      aspectRatio: '4:3',
      model: 'sora',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'aspectRatio must be one of: 16:9, 9:16, 21:9, 1:1',
    });
  });

  it('rejects unknown model identifiers', () => {
    const result = parseVideoPreviewRequest({
      prompt: 'Cinematic prompt',
      aspectRatio: '16:9',
      model: 'model-that-does-not-exist',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected parse failure for unknown model');
    }
    expect(result.status).toBe(400);
    expect(result.error).toContain('Unknown model');
  });

  it('accepts known model aliases, keys, and IDs', () => {
    const acceptedModels = ['sora', 'SORA_2', VIDEO_MODELS.SORA_2];

    for (const model of acceptedModels) {
      const result = parseVideoPreviewRequest({
        prompt: 'Cinematic prompt',
        aspectRatio: '16:9',
        model,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        continue;
      }
      expect(result.payload.model).toBe(model);
    }
  });
});

describe('sendVideoContent regression', () => {
  it('streams video data through pipeline and sets response headers', async () => {
    const response = new MockResponse();
    await sendVideoContent(response as unknown as Response, {
      contentType: 'video/mp4',
      contentLength: 5,
      stream: Readable.from([Buffer.from('video')]),
    });

    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(response.headers.get('Content-Length')).toBe('5');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=600');
    expect(Buffer.concat(response.chunks).toString('utf8')).toBe('video');
  });

  it('destroys the response and rethrows when stream errors after headers are sent', async () => {
    const response = new MockResponse();
    const failingStream = new Readable({
      read() {
        this.push(Buffer.from('x'));
        this.destroy(new Error('stream exploded'));
      },
    });

    await expect(
      sendVideoContent(response as unknown as Response, {
        contentType: 'video/mp4',
        stream: failingStream,
      })
    ).rejects.toThrow('stream exploded');

    expect(response.headersSent).toBe(true);
    expect(response.destroyError?.message).toContain('stream exploded');
  });
});
