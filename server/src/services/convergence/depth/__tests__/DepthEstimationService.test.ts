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
  let mockStorageService: { upload: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService = {
      upload: vi.fn().mockResolvedValue('https://storage.example.com/depth.png'),
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
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        'https://fal.media/files/depth-output.png',
        expect.stringContaining('convergence/')
      );
      expect(result).toBe('https://storage.example.com/depth.png');
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

      const resultPromise = service.estimateDepth('https://example.com/image.jpg');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fal.subscribe).toHaveBeenCalled();
      expect(mockReplicateRun).toHaveBeenCalledWith(
        'cjwbw/depth-anything',
        expect.any(Object)
      );
      expect(result).toBe('https://storage.example.com/depth.png');
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
});
