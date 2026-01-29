import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { AvailabilityGateService } from '../services/AvailabilityGateService';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoAvailabilitySnapshot, VideoAvailabilitySnapshotModel } from '@services/video-generation/types';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { UserCreditService } from '@services/credits/UserCreditService';

type MockVideoGenerationService = {
  getAvailabilitySnapshot: MockedFunction<VideoGenerationService['getAvailabilitySnapshot']>;
};

type MockUserCreditService = {
  getBalance: MockedFunction<UserCreditService['getBalance']>;
};

const createSnapshot = (models: VideoAvailabilitySnapshotModel[]): VideoAvailabilitySnapshot => ({
  models,
  availableModelIds: models.filter((model) => model.available).map((model) => model.id),
  unknownModelIds: models.filter((model) => model.reason === 'unknown_availability').map((model) => model.id),
});

describe('AvailabilityGateService', () => {
  describe('error handling', () => {
    it('filters all models when video generation service is unavailable', async () => {
      const service = new AvailabilityGateService(null, null);
      const result = await service.filterModels(
        [VIDEO_MODELS.SORA_2, VIDEO_MODELS.VEO_3],
        { mode: 't2v', durationSeconds: 8 }
      );

      expect(result.availableModelIds).toEqual([]);
      expect(result.unknownModelIds).toHaveLength(2);
      expect(result.filteredOut).toHaveLength(2);
      expect(result.filteredOut[0]?.reason).toBe('unknown_availability');
    });
  });

  describe('core behavior', () => {
    it('filters out models that do not support image input in i2v mode', async () => {
      const snapshot = createSnapshot([
        {
          id: VIDEO_MODELS.SORA_2,
          available: true,
          supportsI2V: true,
        },
        {
          id: VIDEO_MODELS.DRAFT,
          available: true,
          supportsI2V: false,
        },
      ]);

      const mockVideoService: MockVideoGenerationService = {
        getAvailabilitySnapshot: vi
          .fn<VideoGenerationService['getAvailabilitySnapshot']>()
          .mockReturnValue(snapshot),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        null
      );

      const result = await service.filterModels(
        [VIDEO_MODELS.SORA_2, VIDEO_MODELS.DRAFT],
        { mode: 'i2v', durationSeconds: 8 }
      );

      expect(result.availableModelIds).toEqual([VIDEO_MODELS.SORA_2]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([{ modelId: VIDEO_MODELS.DRAFT, reason: 'image_input_unsupported' }])
      );
    });

    it('filters out models when user credits are insufficient', async () => {
      const snapshot = createSnapshot([
        {
          id: VIDEO_MODELS.VEO_3,
          available: true,
          supportsI2V: true,
        },
      ]);

      const mockVideoService: MockVideoGenerationService = {
        getAvailabilitySnapshot: vi
          .fn<VideoGenerationService['getAvailabilitySnapshot']>()
          .mockReturnValue(snapshot),
      };
      const mockCreditService: MockUserCreditService = {
        getBalance: vi.fn<UserCreditService['getBalance']>().mockResolvedValue(1),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        mockCreditService as unknown as UserCreditService
      );

      const result = await service.filterModels([VIDEO_MODELS.VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
        userId: 'user-1',
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([{ modelId: VIDEO_MODELS.VEO_3, reason: 'insufficient_credits' }])
      );
    });

    it('marks models as unknown when snapshot is missing entries', async () => {
      const snapshot = createSnapshot([]);

      const mockVideoService: MockVideoGenerationService = {
        getAvailabilitySnapshot: vi
          .fn<VideoGenerationService['getAvailabilitySnapshot']>()
          .mockReturnValue(snapshot),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        null
      );

      const result = await service.filterModels([VIDEO_MODELS.VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.unknownModelIds).toEqual([VIDEO_MODELS.VEO_3]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([{ modelId: VIDEO_MODELS.VEO_3, reason: 'unknown_availability' }])
      );
    });
  });
});
