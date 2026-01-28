import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import type { StoredVideoAsset, VideoAssetStore } from './types';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

export function toNodeReadableStream(
  body: ReadableStream<Uint8Array> | null
): NodeJS.ReadableStream {
  if (!body) {
    throw new Error('Response body is empty');
  }
  return Readable.fromWeb(body);
}

export async function storeVideoFromUrl(
  assetStore: VideoAssetStore,
  url: string,
  log?: LogSink
): Promise<StoredVideoAsset> {
  log?.info('Downloading provider video for storage', { url });
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Video download failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const stream = toNodeReadableStream(response.body as ReadableStream<Uint8Array> | null);
  return await assetStore.storeFromStream(stream, contentType);
}
