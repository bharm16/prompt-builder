import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GCSStorageService } from '../StorageService';

const { uuidMock } = vi.hoisted(() => ({
  uuidMock: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: uuidMock,
}));

interface MockFile {
  save: ReturnType<typeof vi.fn>;
  getSignedUrl: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

const createBucketMock = () => {
  const files = new Map<string, MockFile>();
  const bucket = {
    name: 'test-bucket',
    file: vi.fn((path: string): MockFile => {
      if (!files.has(path)) {
        files.set(path, {
          save: vi.fn().mockResolvedValue(undefined),
          getSignedUrl: vi.fn().mockResolvedValue([
            `https://signed.example.com/${encodeURIComponent(path)}`,
          ]),
          delete: vi.fn().mockResolvedValue(undefined),
        });
      }
      return files.get(path)!;
    }),
  };
  return { bucket, files };
};

describe('GCSStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    uuidMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads fetched content and returns signed URL', async () => {
    const { bucket, files } = createBucketMock();
    const service = new GCSStorageService(bucket as never);
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: vi.fn((key: string) => (key === 'content-type' ? 'image/jpeg; charset=utf-8' : null)),
      },
      arrayBuffer: vi.fn(async () => Buffer.from('image-bytes')),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn(async () => response));

    const signedUrl = await service.upload(
      'https://replicate.delivery/temp.png',
      'convergence/user-1/image.png'
    );

    const file = files.get('convergence/user-1/image.png');
    expect(file).toBeDefined();
    expect(file?.save).toHaveBeenCalledTimes(1);
    const saveArgs = file?.save.mock.calls[0];
    expect(saveArgs?.[0]).toEqual(Buffer.from('image-bytes'));
    expect(saveArgs?.[1]).toMatchObject({
      contentType: 'image/jpeg',
    });
    expect(file?.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        expires: expect.any(Number),
      })
    );
    expect(signedUrl).toBe('https://signed.example.com/convergence%2Fuser-1%2Fimage.png');
  });

  it('throws when source fetch is non-OK', async () => {
    const { bucket } = createBucketMock();
    const service = new GCSStorageService(bucket as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }))
    );

    await expect(
      service.upload('https://replicate.delivery/missing.png', 'convergence/user-1/missing.png')
    ).rejects.toThrow('Failed to fetch image: 404 Not Found');
  });

  it('normalizes content type in uploadBuffer', async () => {
    const { bucket, files } = createBucketMock();
    const service = new GCSStorageService(bucket as never);

    const signedUrl = await service.uploadBuffer(
      Buffer.from('buffer-bytes'),
      'convergence/user-2/buffer.webp',
      'IMAGE/WEBP; charset=UTF-8'
    );

    const file = files.get('convergence/user-2/buffer.webp');
    expect(file?.save).toHaveBeenCalledWith(
      Buffer.from('buffer-bytes'),
      expect.objectContaining({
        contentType: 'image/webp',
      })
    );
    expect(signedUrl).toBe('https://signed.example.com/convergence%2Fuser-2%2Fbuffer.webp');
  });

  it('uploadBatch preserves input order while generating per-file destinations', async () => {
    const { bucket } = createBucketMock();
    const service = new GCSStorageService(bucket as never);
    uuidMock.mockReturnValueOnce('id-1').mockReturnValueOnce('id-2').mockReturnValueOnce('id-3');
    const uploadSpy = vi
      .spyOn(service, 'upload')
      .mockImplementation(async (_tempUrl, destination) => `signed:${destination}`);

    const result = await service.uploadBatch(
      [
        'https://replicate.delivery/first.png',
        'https://replicate.delivery/second.png',
        'https://replicate.delivery/third.png',
      ],
      'convergence/user-3'
    );

    expect(uploadSpy).toHaveBeenCalledTimes(3);
    expect(uploadSpy.mock.calls).toEqual([
      ['https://replicate.delivery/first.png', 'convergence/user-3/id-1.png'],
      ['https://replicate.delivery/second.png', 'convergence/user-3/id-2.png'],
      ['https://replicate.delivery/third.png', 'convergence/user-3/id-3.png'],
    ]);
    expect(result).toEqual([
      'signed:convergence/user-3/id-1.png',
      'signed:convergence/user-3/id-2.png',
      'signed:convergence/user-3/id-3.png',
    ]);
  });

  it('delete handles supported URL styles and ignores delete failures', async () => {
    const { bucket, files } = createBucketMock();
    const service = new GCSStorageService(bucket as never);

    const failingPath = 'convergence/user-4/b.png';
    files.set(failingPath, {
      save: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi
        .fn()
        .mockResolvedValue([`https://signed.example.com/${encodeURIComponent(failingPath)}`]),
      delete: vi.fn().mockRejectedValue(new Error('already deleted')),
    });

    await expect(
      service.delete([
        'https://storage.googleapis.com/test-bucket/convergence/user-4/a.png?X-Goog-Signature=abc',
        'https://test-bucket.storage.googleapis.com/convergence/user-4/b.png',
        'convergence/user-4/c.png',
        'https://storage.googleapis.com/other-bucket/convergence/skip.png',
      ])
    ).resolves.toBeUndefined();

    expect(bucket.file).toHaveBeenCalledWith('convergence/user-4/a.png');
    expect(bucket.file).toHaveBeenCalledWith('convergence/user-4/b.png');
    expect(bucket.file).toHaveBeenCalledWith('convergence/user-4/c.png');
    const fileA = files.get('convergence/user-4/a.png');
    const fileB = files.get('convergence/user-4/b.png');
    const fileC = files.get('convergence/user-4/c.png');
    expect(fileA?.delete).toHaveBeenCalledTimes(1);
    expect(fileB?.delete).toHaveBeenCalledTimes(1);
    expect(fileC?.delete).toHaveBeenCalledTimes(1);
  });

  it('uploadFromUrl normalizes destination prefix before delegating to upload', async () => {
    const { bucket } = createBucketMock();
    const service = new GCSStorageService(bucket as never);
    uuidMock.mockReturnValueOnce('generated-id');
    const uploadSpy = vi.spyOn(service, 'upload').mockResolvedValue('https://signed.example.com/final');

    const signed = await service.uploadFromUrl(
      'https://images.example.com/source.png',
      'convergence/user-5/final-frame///'
    );

    expect(uploadSpy).toHaveBeenCalledWith(
      'https://images.example.com/source.png',
      'convergence/user-5/final-frame/generated-id.png'
    );
    expect(signed).toBe('https://signed.example.com/final');
  });
});
