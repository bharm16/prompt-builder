import { VIDEO_MODELS } from './modelConfig';

export const VIDEO_GENERATION_COSTS = {
  [VIDEO_MODELS.SORA_2]: 80,
  [VIDEO_MODELS.SORA_2_PRO]: 80,
  [VIDEO_MODELS.LUMA_RAY3]: 40,
  [VIDEO_MODELS.KLING_V2_1]: 35,
  [VIDEO_MODELS.VEO_3]: 30,
  [VIDEO_MODELS.TIER_1]: 15,
  [VIDEO_MODELS.DRAFT]: 5,
  [VIDEO_MODELS.PRO]: 5,
  [VIDEO_MODELS.ARTISTIC]: 30,
  [VIDEO_MODELS.TIER_2]: 30,
} as const;

export const DEFAULT_VIDEO_COST = 40;

export function getVideoCost(modelId?: string): number {
  if (!modelId) return DEFAULT_VIDEO_COST;
  return VIDEO_GENERATION_COSTS[modelId as keyof typeof VIDEO_GENERATION_COSTS] || DEFAULT_VIDEO_COST;
}
