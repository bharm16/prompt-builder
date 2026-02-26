import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
}));

vi.mock(
  '@infrastructure/Logger',
  () => ({
    logger: {
      child: () => ({
        warn: mocks.loggerWarn,
      }),
    },
  })
);

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { v4 as uuidv4 } from 'uuid';
import { LocalVideoAssetStore } from '../LocalVideoAssetStore';

describe('LocalVideoAssetStore', () => {
  let tempDir: string;
  let uuidMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'local-video-store-'));
    uuidMock = uuidv4 as unknown as ReturnType<typeof vi.fn>;
    uuidMock.mockReset();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('stores from buffer and exposes stream and public URL', async () => {
    uuidMock.mockReturnValue('asset-buffer-1');
    const store = new LocalVideoAssetStore({
      directory: tempDir,
      publicPath: '/api/preview/video/content',
    });

    const saved = await store.storeFromBuffer(Buffer.from('video-bytes'), 'video/mp4');
    const streamed = await store.getStream('asset-buffer-1');
    const url = await store.getPublicUrl('asset-buffer-1');

    expect(saved.id).toBe('asset-buffer-1');
    expect(saved.contentType).toBe('video/mp4');
    expect(saved.sizeBytes).toBe(11);
    expect(saved.url).toBe('/api/preview/video/content/asset-buffer-1');
    expect(streamed?.contentType).toBe('video/mp4');
    expect(streamed?.contentLength).toBe(11);
    expect(url).toBe('/api/preview/video/content/asset-buffer-1');
  });

  it('stores from stream and records metadata with file size', async () => {
    uuidMock.mockReturnValue('asset-stream-1');
    const store = new LocalVideoAssetStore({
      directory: tempDir,
      publicPath: '/preview/videos/',
    });

    const stream = Readable.from(Buffer.from([1, 2, 3, 4, 5]));
    const saved = await store.storeFromStream(stream, 'video/webm');

    const metadataRaw = await readFile(path.join(tempDir, 'asset-stream-1.json'), 'utf8');
    const metadata = JSON.parse(metadataRaw) as {
      contentType: string;
      sizeBytes: number;
    };

    expect(saved.id).toBe('asset-stream-1');
    expect(saved.sizeBytes).toBe(5);
    expect(saved.url).toBe('/preview/videos/asset-stream-1');
    expect(metadata).toMatchObject({
      contentType: 'video/webm',
      sizeBytes: 5,
    });
  });

  it('returns null when metadata is invalid or backing file is missing', async () => {
    const store = new LocalVideoAssetStore({
      directory: tempDir,
      publicPath: '/api/preview/video/content',
    });

    await writeFile(path.join(tempDir, 'broken.json'), '{not-json');
    await writeFile(
      path.join(tempDir, 'missing-data.json'),
      JSON.stringify({ contentType: 'video/mp4', sizeBytes: 10, createdAt: Date.now() })
    );

    expect(await store.getStream('broken')).toBeNull();
    expect(await store.getStream('missing-data')).toBeNull();
    expect(await store.getPublicUrl('broken')).toBeNull();
  });

  it('cleans up only expired assets and ignores invalid cutoff values', async () => {
    const now = Date.now();
    await writeFile(path.join(tempDir, 'old-asset'), 'old-bytes');
    await writeFile(
      path.join(tempDir, 'old-asset.json'),
      JSON.stringify({ contentType: 'video/mp4', sizeBytes: 9, createdAt: now - 10_000 })
    );
    await writeFile(path.join(tempDir, 'fresh-asset'), 'fresh-bytes');
    await writeFile(
      path.join(tempDir, 'fresh-asset.json'),
      JSON.stringify({ contentType: 'video/mp4', sizeBytes: 11, createdAt: now - 100 })
    );

    const store = new LocalVideoAssetStore({
      directory: tempDir,
      publicPath: '/api/preview/video/content',
    });

    expect(await store.cleanupExpired(Number.NaN)).toBe(0);

    const deleted = await store.cleanupExpired(now - 1_000);

    expect(deleted).toBe(1);
    expect(await store.getStream('old-asset')).toBeNull();
    expect(await store.getStream('fresh-asset')).not.toBeNull();
  });
});
