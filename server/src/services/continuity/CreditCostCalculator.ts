import { getVideoCost } from '@config/modelCosts';
import type { ContinuitySession, ContinuityShot, ContinuityMode, GenerationMode } from './types';

const KEYFRAME_CREDIT_COST = 2;
const STYLE_KEYFRAME_CREDIT_COST = 2;

export interface ShotCostSummary {
  generationMode: GenerationMode;
  continuityMode: ContinuityMode;
  videoCost: number;
  extraCost: number;
  perAttemptCost: number;
  maxRetries: number;
  totalCost: number;
}

export class CreditCostCalculator {
  static calculateShotCost(shot: ContinuityShot, session: ContinuitySession): ShotCostSummary {
    const generationMode = shot.generationMode || session.defaultSettings.generationMode;
    const continuityMode = generationMode === 'continuity' ? shot.continuityMode : 'none';

    const videoCost = getVideoCost(shot.modelId);
    let extraCost = 0;
    if (generationMode === 'continuity' && continuityMode === 'style-match') {
      if (shot.characterAssetId || session.defaultSettings.useCharacterConsistency) {
        extraCost += KEYFRAME_CREDIT_COST;
      } else {
        extraCost += STYLE_KEYFRAME_CREDIT_COST;
      }
    } else if (generationMode === 'standard' && shot.characterAssetId) {
      extraCost += KEYFRAME_CREDIT_COST;
    }

    const maxRetries = session.defaultSettings.maxRetries ?? 1;
    const perAttemptCost = videoCost + extraCost;
    const totalCost = perAttemptCost * (maxRetries + 1);

    return {
      generationMode,
      continuityMode,
      videoCost,
      extraCost,
      perAttemptCost,
      maxRetries,
      totalCost,
    };
  }
}
