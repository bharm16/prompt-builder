import { logger } from '@infrastructure/Logger';
import { getVideoCost } from '@config/modelCosts';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoAvailabilityReport } from '@services/video-generation/types';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { VideoModelId } from '@services/video-generation/types';

interface AvailabilityGateOptions {
  mode: 't2v' | 'i2v';
  durationSeconds: number;
  userId?: string | null;
}

interface AvailabilityGateResult {
  availableModelIds: VideoModelId[];
  filteredOut: Array<{ modelId: VideoModelId; reason: string }>;
  report: VideoAvailabilityReport | null;
}

const log = logger.child({ service: 'AvailabilityGateService' });

const isUserIdEligibleForCredits = (userId: string | null | undefined): boolean => {
  if (!userId) return false;
  if (userId.startsWith('api-key:') || userId.startsWith('dev-api-key:')) return false;
  return true;
};

export class AvailabilityGateService {
  constructor(
    private readonly videoGenerationService: VideoGenerationService | null,
    private readonly userCreditService: UserCreditService | null
  ) {}

  async filterModels(
    modelIds: VideoModelId[],
    options: AvailabilityGateOptions
  ): Promise<AvailabilityGateResult> {
    if (!this.videoGenerationService) {
      return {
        availableModelIds: [],
        filteredOut: modelIds.map((modelId) => ({ modelId, reason: 'video_generation_unavailable' })),
        report: null,
      };
    }

    const report = this.videoGenerationService.getAvailabilityReport(modelIds);
    const availableSet = new Set(report.availableModels);
    const filteredOut: Array<{ modelId: VideoModelId; reason: string }> = [];
    const availableModelIds: VideoModelId[] = [];

    let creditBalance: number | null = null;
    if (this.userCreditService && isUserIdEligibleForCredits(options.userId)) {
      try {
        creditBalance = await this.userCreditService.getBalance(options.userId as string);
      } catch (error) {
        log.warn('Failed to resolve credit balance for availability gating', {
          error: error instanceof Error ? error.message : String(error),
          userId: options.userId,
        });
      }
    }

    for (const modelId of modelIds) {
      const availability = report.models.find((model) => model.id === modelId || model.resolvedModelId === modelId);
      if (!availability || !availability.available || !availableSet.has(modelId)) {
        filteredOut.push({ modelId, reason: availability?.reason ?? 'unavailable' });
        continue;
      }

      if (availability.entitled === false) {
        filteredOut.push({ modelId, reason: 'not_entitled' });
        continue;
      }

      if (options.mode === 'i2v' && availability.supportsImageInput === false) {
        filteredOut.push({ modelId, reason: 'image_input_unsupported' });
        continue;
      }
      if (options.mode === 'i2v' && availability.supportsI2V === false) {
        filteredOut.push({ modelId, reason: 'image_input_unsupported' });
        continue;
      }

      if (creditBalance !== null) {
        const requiredCredits = getVideoCost(modelId, options.durationSeconds);
        if (creditBalance < requiredCredits) {
          filteredOut.push({ modelId, reason: 'insufficient_credits' });
          continue;
        }
      }

      availableModelIds.push(modelId);
    }

    return { availableModelIds, filteredOut, report };
  }
}
