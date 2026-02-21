import { logger } from '@infrastructure/Logger';
import { getVideoCost } from '@config/modelCosts';
import { isPlanTierEligible, MODEL_TIER_REQUIREMENTS, resolveDefaultPlanTier } from '@config/subscriptionTiers';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoAvailabilitySnapshot } from '@services/video-generation/types';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { VideoModelId } from '@services/video-generation/types';
import type { BillingProfileStore } from '@services/payment/BillingProfileStore';
import type { PlanTier } from '@config/subscriptionTiers';

interface AvailabilityGateOptions {
  mode: 't2v' | 'i2v';
  durationSeconds: number;
  userId?: string | null;
}

interface AvailabilityGateResult {
  availableModelIds: VideoModelId[];
  unknownModelIds: VideoModelId[];
  filteredOut: Array<{ modelId: VideoModelId; reason: string }>;
  snapshot: VideoAvailabilitySnapshot | null;
}

const log = logger.child({ service: 'AvailabilityGateService' });
const UNKNOWN_REASONS = new Set(['unknown_availability', 'video_generation_unavailable']);

const isUserIdEligibleForCredits = (userId: string | null | undefined): boolean => {
  if (!userId) return false;
  if (userId.startsWith('api-key:')) return false;
  return true;
};

export class AvailabilityGateService {
  constructor(
    private readonly videoGenerationService: VideoGenerationService | null,
    private readonly userCreditService: UserCreditService | null,
    private readonly billingProfileStore?: BillingProfileStore | null
  ) {}

  async filterModels(
    modelIds: VideoModelId[],
    options: AvailabilityGateOptions
  ): Promise<AvailabilityGateResult> {
    if (!this.videoGenerationService) {
      return {
        availableModelIds: [],
        unknownModelIds: [...modelIds],
        filteredOut: modelIds.map((modelId) => ({ modelId, reason: 'unknown_availability' })),
        snapshot: null,
      };
    }

    const snapshot = this.videoGenerationService.getAvailabilitySnapshot(modelIds);
    const filteredOut: Array<{ modelId: VideoModelId; reason: string }> = [];
    const availableModelIds: VideoModelId[] = [];
    const unknownModelIds: VideoModelId[] = [];
    const snapshotMap = new Map(snapshot.models.map((model) => [model.id, model]));
    const planTier = await this.resolvePlanTier(options.userId);
    const entitlementByModel = new Map<VideoModelId, { entitled: boolean | undefined }>();

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
      const availability = snapshotMap.get(modelId);
      if (!availability) {
        unknownModelIds.push(modelId);
        filteredOut.push({ modelId, reason: 'unknown_availability' });
        continue;
      }

      if (!availability.available) {
        const reason = availability.reason ?? 'unknown_availability';
        if (UNKNOWN_REASONS.has(reason)) {
          unknownModelIds.push(modelId);
        }
        filteredOut.push({ modelId, reason });
        continue;
      }

      const entitlement = this.resolveEntitlement(planTier, modelId);
      entitlementByModel.set(modelId, entitlement);
      if (entitlement.entitled === false) {
        filteredOut.push({ modelId, reason: 'not_entitled' });
        continue;
      }

      if (availability.entitled === false) {
        filteredOut.push({ modelId, reason: 'not_entitled' });
        continue;
      }

      if (options.mode === 'i2v') {
        const supportsI2V = availability.supportsI2V ?? availability.supportsImageInput;
        if (supportsI2V === false) {
          filteredOut.push({ modelId, reason: 'image_input_unsupported' });
          continue;
        }
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

    const snapshotWithEntitlements: VideoAvailabilitySnapshot = {
      ...snapshot,
      models: snapshot.models.map((model) => {
        const entitlement = entitlementByModel.get(model.id);
        const entitled = entitlement?.entitled;
        return {
          ...model,
          planTier,
          ...(entitled !== undefined ? { entitled } : {}),
        };
      }),
    };

    return { availableModelIds, unknownModelIds, filteredOut, snapshot: snapshotWithEntitlements };
  }

  private async resolvePlanTier(userId?: string | null): Promise<PlanTier> {
    if (!userId) return 'unknown';
    if (!isUserIdEligibleForCredits(userId)) return 'unknown';
    if (!this.billingProfileStore) return 'unknown';
    try {
      const profile = await this.billingProfileStore.getProfile(userId);
      return resolveDefaultPlanTier(profile?.planTier, 'unknown');
    } catch (error) {
      log.warn('Failed to resolve plan tier for availability gating', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'unknown';
    }
  }

  private resolveEntitlement(
    planTier: PlanTier,
    modelId: VideoModelId
  ): { entitled: boolean | undefined } {
    const requiredTier = MODEL_TIER_REQUIREMENTS[modelId];
    if (!requiredTier) {
      return { entitled: true };
    }
    if (planTier === 'unknown') {
      return { entitled: true };
    }
    return { entitled: isPlanTierEligible(planTier, requiredTier) };
  }
}
