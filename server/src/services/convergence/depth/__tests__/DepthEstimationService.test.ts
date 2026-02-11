import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fal } from '@fal-ai/client';
import Replicate from 'replicate';
import { ReplicateDepthEstimationService } from '../DepthEstimationService';

vi.mock('@fal-ai/client', () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock('replicate', () => ({
  default: vi.fn(),
}));

describe('DepthEstimationService', () => {
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
      upload: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
      uploadBatch: vi.fn().mockResolvedValue([]),
      uploadFromUrl: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
      uploadBuffer: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('estimateDepth with fal.ai', () => {
    it('should use fal.ai as primary provider', async () => {
      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          image: {
            url: 'https://fal.media/files/depth-output.png',
            content_type: 'image/png',
          },
        },
      });

      const service = new ReplicateDepthEstimationService({
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
      expect(mockStorageService.upload).not.toHaveBeenCalled();
      expect(result).toBe('https://fal.media/files/depth-output.png');
    });

    it('should fallback to Replicate when fal.ai fails', async () => {
      vi.useFakeTimers();

      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fal.ai error')
      );

      const mockReplicateRun = vi.fn().mockResolvedValue('https://replicate.delivery/depth.png');
      (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        run: mockReplicateRun,
      }));

      const service = new ReplicateDepthEstimationService({
        falApiKey: 'test-fal-key',
        replicateApiToken: 'test-replicate-token',
        storageService: mockStorageService,
      });

      const resultPromise = service.estimateDepth('https://example.com/image-fallback.jpg');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fal.subscribe).toHaveBeenCalled();
      expect(mockReplicateRun).toHaveBeenCalledWith(
        'chenxwh/depth-anything-v2',
        expect.any(Object)
      );
      expect(result).toBe('https://replicate.delivery/depth.png');
    });

    it('propagates fal failure when replicate fallback is unavailable', async () => {
      vi.useFakeTimers();
      (fal.subscribe as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fal unavailable')
      );

      const service = new ReplicateDepthEstimationService({
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

      const service = new ReplicateDepthEstimationService({
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
  });

  describe('estimateDepth with replicate output parsing', () => {
    it('extracts grey_depth string URL output', async () => {
      const mockReplicateRun = vi.fn().mockResolvedValue({
        grey_depth: 'https://replicate.delivery/grey-depth.png',
      });
      (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        run: mockReplicateRun,
      }));

      const service = new ReplicateDepthEstimationService({
        replicateApiToken: 'test-replicate-token',
        storageService: mockStorageService,
      });

      const result = await service.estimateDepth('https://example.com/replicate-grey-depth.jpg');

      expect(result).toBe('https://replicate.delivery/grey-depth.png');
    });

    it('extracts URL from object-style replicate output', async () => {
      const mockReplicateRun = vi.fn().mockResolvedValue({
        grey_depth: {
          url: () => 'https://replicate.delivery/object-depth.png',
        },
      });
      (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        run: mockReplicateRun,
      }));

      const service = new ReplicateDepthEstimationService({
        replicateApiToken: 'test-replicate-token',
        storageService: mockStorageService,
      });

      const result = await service.estimateDepth('https://example.com/replicate-object-depth.jpg');

      expect(result).toBe('https://replicate.delivery/object-depth.png');
    });

    it('throws when replicate output cannot be parsed into a URL', async () => {
      vi.useFakeTimers();
      const mockReplicateRun = vi.fn().mockResolvedValue({ unexpected: true });
      (Replicate as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        run: mockReplicateRun,
      }));

      const service = new ReplicateDepthEstimationService({
        replicateApiToken: 'test-replicate-token',
        storageService: mockStorageService,
      });

      const assertion = expect(
        service.estimateDepth('https://example.com/replicate-invalid-output.jpg')
      ).rejects.toThrow('Invalid output format from Replicate: Could not extract depth map URL');
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  describe('isAvailable', () => {
    it('should return true when fal.ai is configured', () => {
      const service = new ReplicateDepthEstimationService({
        falApiKey: 'test-key',
        storageService: mockStorageService,
      });
      expect(service.isAvailable()).toBe(true);
    });

    it('should return true when only Replicate is configured', () => {
      const service = new ReplicateDepthEstimationService({
        replicateApiToken: 'test-token',
        storageService: mockStorageService,
      });
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when no providers configured', () => {
      const service = new ReplicateDepthEstimationService({
        storageService: mockStorageService,
      });
      expect(service.isAvailable()).toBe(false);
    });
  });

  it('throws when estimateDepth is called with no providers configured', async () => {
    const service = new ReplicateDepthEstimationService({
      storageService: mockStorageService,
    });

    await expect(service.estimateDepth('https://example.com/no-providers.jpg')).rejects.toThrow(
      'Depth estimation service is not available: no providers configured'
    );
  });
});
