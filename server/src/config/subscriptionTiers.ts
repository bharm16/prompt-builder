import { VIDEO_MODELS } from './modelConfig';
import type { VideoModelId } from '@services/video-generation/types';

export type PlanTier = 'free' | 'explorer' | 'creator' | 'agency' | 'unknown';

export const PLAN_TIER_ORDER: Record<PlanTier, number> = {
  unknown: 0,
  free: 0,
  explorer: 1,
  creator: 2,
  agency: 3,
};

export const PLAN_TIER_BY_PRICE_ID: Record<string, PlanTier> = {
  price_explorer_monthly: 'explorer',
  price_creator_monthly: 'creator',
  price_agency_monthly: 'agency',
};

const DEFAULT_MODEL_TIER_REQUIREMENTS: Partial<Record<VideoModelId, PlanTier>> = {
  // Leave empty to avoid gating unless explicitly configured.
};

const normalizePlanTier = (value: unknown): PlanTier => {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'free') return 'free';
  if (normalized === 'explorer') return 'explorer';
  if (normalized === 'creator') return 'creator';
  if (normalized === 'agency') return 'agency';
  return 'unknown';
};

const parseTierRequirements = (): Partial<Record<VideoModelId, PlanTier>> => {
  const raw = process.env.MODEL_TIER_REQUIREMENTS;
  if (!raw) {
    return DEFAULT_MODEL_TIER_REQUIREMENTS;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const resolved: Partial<Record<VideoModelId, PlanTier>> = {};
    for (const [modelId, tier] of Object.entries(parsed)) {
      if (!modelId) continue;
      const normalizedTier = normalizePlanTier(tier);
      if (normalizedTier === 'unknown') continue;
      resolved[modelId as VideoModelId] = normalizedTier;
    }
    return resolved;
  } catch {
    return DEFAULT_MODEL_TIER_REQUIREMENTS;
  }
};

export const MODEL_TIER_REQUIREMENTS = parseTierRequirements();

export const resolvePlanTierFromPriceIds = (priceIds: string[]): PlanTier | null => {
  let resolved: PlanTier | null = null;
  for (const priceId of priceIds) {
    const tier = PLAN_TIER_BY_PRICE_ID[priceId];
    if (!tier) continue;
    if (!resolved || PLAN_TIER_ORDER[tier] > PLAN_TIER_ORDER[resolved]) {
      resolved = tier;
    }
  }
  return resolved;
};

export const isPlanTierEligible = (planTier: PlanTier, requiredTier: PlanTier): boolean => {
  return PLAN_TIER_ORDER[planTier] >= PLAN_TIER_ORDER[requiredTier];
};

export const resolveDefaultPlanTier = (value: unknown, fallback: PlanTier = 'unknown'): PlanTier => {
  const normalized = normalizePlanTier(value);
  return normalized === 'unknown' ? fallback : normalized;
};

export const CANONICAL_PLAN_TIER_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  explorer: 'Explorer',
  creator: 'Creator',
  agency: 'Agency',
  unknown: 'Unknown',
};

export const CANONICAL_MODEL_TIER_LABELS: Record<VideoModelId, string> = {
  [VIDEO_MODELS.DRAFT]: 'draft',
  [VIDEO_MODELS.DRAFT_I2V]: 'draft',
  [VIDEO_MODELS.PRO]: 'pro',
  [VIDEO_MODELS.SORA_2]: 'flagship',
  [VIDEO_MODELS.SORA_2_PRO]: 'flagship',
  [VIDEO_MODELS.KLING_V2_1]: 'production',
  [VIDEO_MODELS.LUMA_RAY3]: 'production',
  [VIDEO_MODELS.VEO_3]: 'production',
  [VIDEO_MODELS.ARTISTIC]: 'specialized',
  [VIDEO_MODELS.TIER_1]: 'fallback',
  [VIDEO_MODELS.TIER_2]: 'fallback',
};
