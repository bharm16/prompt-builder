import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { AvailabilityGateService } from '../services/AvailabilityGateService';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoAvailabilityReport, VideoModelAvailability } from '@services/video-generation/types';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { UserCreditService } from '@services/credits/UserCreditService';

type MockVideoGenerationService = {
  getAvailabilityReport: MockedFunction<VideoGenerationService['getAvailabilityReport']>;
};

type MockUserCreditService = {
  getBalance: MockedFunction<UserCreditService['getBalance']>;
};

const createReport = (models: VideoModelAvailability[]): VideoAvailabilityReport => ({
  providers: { replicate: true, openai: true, luma: true, kling: true, gemini: true },
  models,
  availableModels: models.filter((model) => model.available).map((model) => model.resolvedModelId ?? model.id),
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
      expect(result.filteredOut).toHaveLength(2);
      expect(result.filteredOut[0]?.reason).toBe('video_generation_unavailable');
    });
  });

  describe('core behavior', () => {
    it('filters out models that do not support image input in i2v mode', async () => {
      const report = createReport([
        {
          id: VIDEO_MODELS.SORA_2,
          available: true,
          resolvedModelId: VIDEO_MODELS.SORA_2,
          supportsImageInput: true,
        },
        {
          id: VIDEO_MODELS.DRAFT,
          available: true,
          resolvedModelId: VIDEO_MODELS.DRAFT,
          supportsImageInput: false,
        },
      ]);

      const mockVideoService: MockVideoGenerationService = {
        getAvailabilityReport: vi.fn<VideoGenerationService['getAvailabilityReport']>().mockReturnValue(report),
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
      const report = createReport([
        {
          id: VIDEO_MODELS.VEO_3,
          available: true,
          resolvedModelId: VIDEO_MODELS.VEO_3,
          supportsImageInput: true,
        },
      ]);

      const mockVideoService: MockVideoGenerationService = {
        getAvailabilityReport: vi.fn<VideoGenerationService['getAvailabilityReport']>().mockReturnValue(report),
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

    it('matches canonical IDs against availability aliases', async () => {
      const report = createReport([
        {
          id: 'veo-3',
          available: true,
          resolvedModelId: VIDEO_MODELS.VEO_3,
          supportsImageInput: true,
        },
      ]);

      const mockVideoService: MockVideoGenerationService = {
        getAvailabilityReport: vi.fn<VideoGenerationService['getAvailabilityReport']>().mockReturnValue(report),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        null
      );

      const result = await service.filterModels([VIDEO_MODELS.VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([VIDEO_MODELS.VEO_3]);
      expect(result.filteredOut).toEqual([]);
    });
  });
});
