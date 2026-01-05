import { VIDEO_MODELS } from './modelConfig';

export const VIDEO_GENERATION_COSTS = {
  [VIDEO_MODELS.SORA_2]: 50,
  [VIDEO_MODELS.SORA_2_PRO]: 50,
  [VIDEO_MODELS.LUMA_RAY3]: 25,
  [VIDEO_MODELS.KLING_V2_1]: 25,
  [VIDEO_MODELS.VEO_3]: 20,
  [VIDEO_MODELS.TIER_1]: 10,
  [VIDEO_MODELS.DRAFT]: 5,
} as const;

export const DEFAULT_VIDEO_COST = 25;

export function getVideoCost(modelId?: string): number {
  if (!modelId) return DEFAULT_VIDEO_COST;
  return VIDEO_GENERATION_COSTS[modelId as keyof typeof VIDEO_GENERATION_COSTS] || DEFAULT_VIDEO_COST;
}
