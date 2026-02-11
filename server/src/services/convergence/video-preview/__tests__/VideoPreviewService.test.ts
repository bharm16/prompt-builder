import { beforeEach, describe, expect, it, vi } from 'vitest';
import Replicate from 'replicate';
import { ReplicateVideoPreviewService } from '../VideoPreviewService';

vi.mock('replicate', () => ({
  default: vi.fn(),
}));

describe('VideoPreviewService', () => {
  let mockStorageService: {
    upload: ReturnType<typeof vi.fn>;
    uploadBatch: ReturnType<typeof vi.fn>;
    uploadFromUrl: ReturnType<typeof vi.fn>;
    uploadBuffer: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService = {
      upload: vi.fn().mockResolvedValue('https://storage.example.com/preview.mp4'),
      uploadBatch: vi.fn().mockResolvedValue([]),
      uploadFromUrl: vi.fn().mockResolvedValue('https://storage.example.com/uploaded.mp4'),
      uploadBuffer: vi.fn().mockResolvedValue('https://storage.example.com/uploaded-buffer.mp4'),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    delete process.env.REPLICATE_API_TOKEN;
  });

  it('is unavailable when no API token is configured', () => {
    const service = new ReplicateVideoPreviewService({
      storageService: mockStorageService,
    });

    expect(service.isAvailable()).toBe(false);
  });

  it('sends correct t2v payload to Replicate and uploads output to storage', async () => {
    const runMock = vi.fn().mockResolvedValue('https://replicate.delivery/t2v.mp4');
    (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      run: runMock,
    }));

    const service = new ReplicateVideoPreviewService({
      apiToken: 'replicate-token',
      storageService: mockStorageService,
      userId: 'user-1',
    });

    const result = await service.generatePreview('camera tracks through neon alley', {
      duration: 4,
      aspectRatio: '9:16',
    });

    expect(result).toBe('https://storage.example.com/preview.mp4');
    expect(runMock).toHaveBeenCalledWith(
      'wan-video/wan-2.2-t2v-fast',
      expect.objectContaining({
        input: expect.objectContaining({
          prompt: 'camera tracks through neon alley',
          size: '720*1280',
          num_frames: 64,
          frames_per_second: 16,
          prompt_extend: true,
          go_fast: true,
        }),
      })
    );
    expect(mockStorageService.upload).toHaveBeenCalledWith(
      'https://replicate.delivery/t2v.mp4',
      expect.stringMatching(/^convergence\/user-1\/preview\/\d+-preview\.mp4$/)
    );
  });

  it('uses i2v model and includes start image in payload', async () => {
    const runMock = vi.fn().mockResolvedValue('https://replicate.delivery/i2v.mp4');
    (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      run: runMock,
    }));

    const service = new ReplicateVideoPreviewService({
      apiToken: 'replicate-token',
      storageService: mockStorageService,
      userId: 'user-2',
    });

    await service.generatePreview('subject turns toward camera', {
      startImage: 'https://images.example.com/frame-0.png',
      aspectRatio: '1:1',
    });

    expect(runMock).toHaveBeenCalledWith(
      'wan-video/wan-2.2-i2v-fast',
      expect.objectContaining({
        input: expect.objectContaining({
          image: 'https://images.example.com/frame-0.png',
          size: '1024*1024',
        }),
      })
    );
  });

  it.each([
    { label: 'string output', output: 'https://replicate.delivery/string-output.mp4' },
    { label: 'object url field', output: { url: 'https://replicate.delivery/object-url.mp4' } },
    { label: 'object url() method', output: { url: () => 'https://replicate.delivery/object-method.mp4' } },
    { label: 'array output', output: ['https://replicate.delivery/array-output.mp4'] },
  ])('extracts URL from %s', async ({ output }) => {
    const runMock = vi.fn().mockResolvedValue(output);
    (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      run: runMock,
    }));

    const service = new ReplicateVideoPreviewService({
      apiToken: 'replicate-token',
      storageService: mockStorageService,
      userId: 'user-3',
    });

    await service.generatePreview('test prompt');

    const expectedTempUrl =
      typeof output === 'string'
        ? output
        : Array.isArray(output)
          ? output[0]
          : typeof output.url === 'function'
            ? output.url()
            : output.url;
    expect(mockStorageService.upload).toHaveBeenCalledWith(
      expectedTempUrl,
      expect.stringMatching(/^convergence\/user-3\/preview\/\d+-preview\.mp4$/)
    );
  });

  it('throws when replicate output format is invalid', async () => {
    const runMock = vi.fn().mockResolvedValue({ invalid: true });
    (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      run: runMock,
    }));

    const service = new ReplicateVideoPreviewService({
      apiToken: 'replicate-token',
      storageService: mockStorageService,
      userId: 'user-4',
    });

    await expect(service.generatePreview('invalid output prompt')).rejects.toThrow(
      'Invalid output format from Replicate: Could not extract video URL'
    );
    expect(mockStorageService.upload).not.toHaveBeenCalled();
  });

  it('propagates storage upload failures', async () => {
    const runMock = vi.fn().mockResolvedValue('https://replicate.delivery/storage-failure.mp4');
    (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      run: runMock,
    }));
    mockStorageService.upload.mockRejectedValueOnce(new Error('gcs upload failed'));

    const service = new ReplicateVideoPreviewService({
      apiToken: 'replicate-token',
      storageService: mockStorageService,
      userId: 'user-5',
    });

    await expect(service.generatePreview('storage failure prompt')).rejects.toThrow(
      'gcs upload failed'
    );
  });
});
