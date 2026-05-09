import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { AvailabilityGateService } from '../services/AvailabilityGateService';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { CanonicalPromptModelId } from '@shared/videoModels';
import type {
  VideoAvailabilitySnapshot,
  VideoAvailabilitySnapshotModel,
} from '@services/video-generation/types';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { BillingProfileStore } from '@services/payment/BillingProfileStore';

type MockVideoGenerationService = {
  getAvailabilitySnapshot: MockedFunction<
    VideoGenerationService['getAvailabilitySnapshot']
  >;
};

type MockUserCreditService = {
  getBalance: MockedFunction<UserCreditService['getBalance']>;
};

type MockBillingProfileStore = {
  getProfile: MockedFunction<BillingProfileStore['getProfile']>;
};

// Canonical id constants — keep test-side aliases tight so the prompt-side
// surface stays the only thing tests assert against.
const SORA_2: CanonicalPromptModelId = 'sora-2';
const VEO_3: CanonicalPromptModelId = 'veo-3';
const WAN_2_2: CanonicalPromptModelId = 'wan-2.2';
const RUNWAY_GEN45: CanonicalPromptModelId = 'runway-gen45';

const createSnapshot = (
  models: VideoAvailabilitySnapshotModel[]
): VideoAvailabilitySnapshot => ({
  models,
  availableModelIds: models
    .filter((model) => model.available)
    .map((model) => model.id),
  unknownModelIds: models
    .filter((model) => model.reason === 'unknown_availability')
    .map((model) => model.id),
});

describe('AvailabilityGateService', () => {
  describe('error handling', () => {
    it('filters all models when video generation service is unavailable', async () => {
      const service = new AvailabilityGateService(null, null);
      const result = await service.filterModels([SORA_2, VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.unknownModelIds).toHaveLength(2);
      expect(result.filteredOut).toHaveLength(2);
      expect(result.filteredOut[0]?.reason).toBe('unknown_availability');
    });
  });

  describe('core behavior', () => {
    it('filters out models that do not support image input in i2v mode', async () => {
      // Snapshot uses generation ids — that's what the
      // VideoGenerationService surface speaks. The gate translates
      // canonical → generation id internally before querying.
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

      const result = await service.filterModels([SORA_2, WAN_2_2], {
        mode: 'i2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([SORA_2]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([
          { modelId: WAN_2_2, reason: 'image_input_unsupported' },
        ])
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
        getBalance: vi
          .fn<UserCreditService['getBalance']>()
          .mockResolvedValue(1),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        mockCreditService as unknown as UserCreditService
      );

      const result = await service.filterModels([VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
        userId: 'user-1',
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([
          { modelId: VEO_3, reason: 'insufficient_credits' },
        ])
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

      const result = await service.filterModels([VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.unknownModelIds).toEqual([VEO_3]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([
          { modelId: VEO_3, reason: 'unknown_availability' },
        ])
      );
    });

    it('preserves unavailable model reasons from availability snapshot', async () => {
      const snapshot = createSnapshot([
        {
          id: VIDEO_MODELS.SORA_2,
          available: false,
          reason: 'missing_credentials',
          requiredKey: 'OPENAI_API_KEY',
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

      const result = await service.filterModels([SORA_2], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.filteredOut).toEqual([
        { modelId: SORA_2, reason: 'missing_credentials' },
      ]);
      expect(result.unknownModelIds).toEqual([]);
    });

    it('filters out models with explicit entitlement=false from snapshot', async () => {
      const snapshot = createSnapshot([
        {
          id: VIDEO_MODELS.SORA_2,
          available: true,
          supportsI2V: true,
          entitled: false,
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

      const result = await service.filterModels([SORA_2], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([]);
      expect(result.filteredOut).toEqual(
        expect.arrayContaining([{ modelId: SORA_2, reason: 'not_entitled' }])
      );
    });

    it('continues without credit gating when balance lookup fails', async () => {
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
        getBalance: vi
          .fn<UserCreditService['getBalance']>()
          .mockRejectedValue(new Error('credit service unavailable')),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        mockCreditService as unknown as UserCreditService
      );

      const result = await service.filterModels([VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
        userId: 'user-1',
      });

      expect(result.availableModelIds).toEqual([VEO_3]);
      expect(result.filteredOut).toEqual([]);
    });

    it('skips credit gating for api-key users', async () => {
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
        getBalance: vi
          .fn<UserCreditService['getBalance']>()
          .mockResolvedValue(0),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        mockCreditService as unknown as UserCreditService
      );

      const result = await service.filterModels([VEO_3], {
        mode: 't2v',
        durationSeconds: 8,
        userId: 'api-key:abc123',
      });

      expect(mockCreditService.getBalance).not.toHaveBeenCalled();
      expect(result.availableModelIds).toEqual([VEO_3]);
    });

    it('enriches snapshot with resolved plan tier from billing profile', async () => {
      const snapshot = createSnapshot([
        {
          id: VIDEO_MODELS.SORA_2,
          available: true,
          supportsI2V: true,
        },
      ]);
      const mockVideoService: MockVideoGenerationService = {
        getAvailabilitySnapshot: vi
          .fn<VideoGenerationService['getAvailabilitySnapshot']>()
          .mockReturnValue(snapshot),
      };
      const billingProfileStore: MockBillingProfileStore = {
        getProfile: vi
          .fn<BillingProfileStore['getProfile']>()
          .mockResolvedValue({
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
            planTier: 'creator',
          }),
      };

      const service = new AvailabilityGateService(
        mockVideoService as unknown as VideoGenerationService,
        null,
        billingProfileStore as unknown as BillingProfileStore
      );

      const result = await service.filterModels([SORA_2], {
        mode: 't2v',
        durationSeconds: 8,
        userId: 'user-1',
      });

      expect(result.snapshot?.models[0]?.planTier).toBe('creator');
      expect(result.snapshot?.models[0]?.entitled).toBe(true);
    });

    // Recommendation-only model (no generation adapter wired in VIDEO_MODELS).
    // The gate must surface it as unknown with reason `no_generation_provider`
    // — the UI can still recommend it, but explain it isn't directly generable.
    it('marks recommendation-only Runway as unknown with no_generation_provider reason', async () => {
      const snapshot = createSnapshot([
        {
          id: VIDEO_MODELS.SORA_2,
          available: true,
          supportsI2V: true,
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

      const result = await service.filterModels([RUNWAY_GEN45, SORA_2], {
        mode: 't2v',
        durationSeconds: 8,
      });

      expect(result.availableModelIds).toEqual([SORA_2]);
      expect(result.unknownModelIds).toEqual([RUNWAY_GEN45]);
      expect(result.filteredOut).toEqual([
        { modelId: RUNWAY_GEN45, reason: 'no_generation_provider' },
      ]);
    });
  });
});
