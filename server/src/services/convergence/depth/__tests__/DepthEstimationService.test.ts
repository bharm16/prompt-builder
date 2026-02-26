import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fal } from '@fal-ai/client';
import { FalDepthEstimationService } from '../DepthEstimationService';

vi.mock('@fal-ai/client', () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('DepthEstimationService', () => {
  let mockStorageService: {
    upload: ReturnType<typeof vi.fn>;
    uploadBatch: ReturnType<typeof vi.fn>;
    uploadFromUrl: ReturnType<typeof vi.fn>;
    uploadBuffer: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    refreshSignedUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService = {
      upload: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
      uploadBatch: vi.fn().mockResolvedValue([]),
      uploadFromUrl: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
      uploadBuffer: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
      delete: vi.fn().mockResolvedValue(undefined),
      refreshSignedUrl: vi.fn().mockResolvedValue(null),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('estimateDepth with fal.ai', () => {
    it('uses fal.ai as provider', async () => {
      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          image: {
            url: 'https://fal.media/files/depth-output.png',
            content_type: 'image/png',
          },
        },
      });

      const service = new FalDepthEstimationService({
        falApiKey: 'test-fal-key',
        storageService: mockStorageService,
      });

      const result = await service.estimateDepth('https://example.com/image.jpg');

      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/image-preprocessors/depth-anything/v2',
        expect.objectContaining({
          input: { image_url: 'https://example.com/image.jpg' },
        })
      );
      expect(result).toBe('https://fal.media/files/depth-output.png');
    });

    it('refreshes signed GCS URLs before calling fal', async () => {
      const staleSignedUrl =
        'https://storage.googleapis.com/vidra-media-prod/users/user-1/previews/images/stale.jpg?X-Goog-Date=20260131T223719Z&X-Goog-Expires=3600';
      const refreshedSignedUrl =
        'https://storage.googleapis.com/vidra-media-prod/users/user-1/previews/images/stale.jpg?X-Goog-Date=20260211T222000Z&X-Goog-Expires=3600';

      mockStorageService.refreshSignedUrl.mockResolvedValue(refreshedSignedUrl);
      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          image: {
            url: 'https://fal.media/files/depth-output.png',
            content_type: 'image/png',
          },
        },
      });

      const service = new FalDepthEstimationService({
        falApiKey: 'test-fal-key',
        storageService: mockStorageService,
      });

      await service.estimateDepth(staleSignedUrl);

      expect(mockStorageService.refreshSignedUrl).toHaveBeenCalledWith(staleSignedUrl);
      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/image-preprocessors/depth-anything/v2',
        expect.objectContaining({
          input: { image_url: refreshedSignedUrl },
        })
      );
    });

    it('propagates fal failure after retries are exhausted', async () => {
      vi.useFakeTimers();
      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fal unavailable')
      );

      const service = new FalDepthEstimationService({
        falApiKey: 'test-fal-key',
        storageService: mockStorageService,
      });

      const assertion = expect(
        service.estimateDepth('https://example.com/fal-only-failure.jpg')
      ).rejects.toThrow('fal unavailable');
      await vi.runAllTimersAsync();
      await assertion;
      expect(fal.subscribe).toHaveBeenCalledTimes(3);
    });

    it('returns cached depth URL on repeated requests for the same image', async () => {
      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          image: {
            url: 'https://fal.media/files/depth-cache.png',
            content_type: 'image/png',
          },
        },
      });

      const service = new FalDepthEstimationService({
        falApiKey: 'test-fal-key',
        storageService: mockStorageService,
      });
      const imageUrl = 'https://example.com/cache-hit-image.jpg';

      const first = await service.estimateDepth(imageUrl);
      const second = await service.estimateDepth(imageUrl);

      expect(first).toBe('https://fal.media/files/depth-cache.png');
      expect(second).toBe('https://fal.media/files/depth-cache.png');
      expect(fal.subscribe).toHaveBeenCalledTimes(1);
    });

    it('retries once after warmup when cold-start fal calls fail', async () => {
      vi.useFakeTimers();

      const targetImageUrl = 'https://example.com/cold-start-image.jpg';
      const warmupImageUrl = 'https://storage.googleapis.com/generativeai-downloads/images/cat.jpg';
      let targetAttempts = 0;

      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        async (_model: string, payload: { input?: { image_url?: string } }) => {
          const requestImageUrl = payload.input?.image_url;
          if (requestImageUrl === targetImageUrl) {
            targetAttempts += 1;
            if (targetAttempts <= 3) {
              throw new Error('Unprocessable Entity');
            }

            return {
              data: {
                image: {
                  url: 'https://fal.media/files/depth-after-warmup.png',
                  content_type: 'image/png',
                },
              },
            };
          }

          if (requestImageUrl === warmupImageUrl) {
            return {
              data: {
                image: {
                  url: 'https://fal.media/files/depth-warmup.png',
                  content_type: 'image/png',
                },
              },
            };
          }

          throw new Error(`Unexpected image URL: ${String(requestImageUrl)}`);
        }
      );

      const service = new FalDepthEstimationService({
        falApiKey: 'test-fal-key',
        storageService: mockStorageService,
      });

      const resultPromise = service.estimateDepth(targetImageUrl);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('https://fal.media/files/depth-after-warmup.png');
      expect(fal.subscribe).toHaveBeenCalledWith(
        'fal-ai/image-preprocessors/depth-anything/v2',
        expect.objectContaining({
          input: { image_url: warmupImageUrl },
        })
      );
    });
  });

  describe('isAvailable', () => {
    it('returns true when fal.ai is configured', () => {
      const service = new FalDepthEstimationService({
        falApiKey: 'test-key',
        storageService: mockStorageService,
      });
      expect(service.isAvailable()).toBe(true);
    });

    it('returns false when fal.ai is not configured', () => {
      const service = new FalDepthEstimationService({
        storageService: mockStorageService,
      });
      expect(service.isAvailable()).toBe(false);
    });
  });

  it('throws when estimateDepth is called without a configured fal.ai provider', async () => {
    const service = new FalDepthEstimationService({
      storageService: mockStorageService,
    });

    await expect(service.estimateDepth('https://example.com/no-providers.jpg')).rejects.toThrow(
      'Depth estimation service is not available: fal.ai provider not configured'
    );
  });
});
