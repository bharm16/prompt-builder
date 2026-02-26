import { VIDEO_MODELS } from './modelConfig';

/**
 * Video Generation Credit Costs (Per-Second Pricing)
 *
 * Credits are charged per second of video generated.
 * This ensures costs scale accurately with actual API expenses.
 *
 * Pricing Strategy (January 2026 Rebalance):
 * - WAN Draft: 165% margin (most used, workflow backbone)
 * - Mid-tier (Kling, Minimax, Luma): 90-240% margin
 * - Premium (Sora, Veo): 50-130% margin (competitive draw, not profit center)
 *
 * API Costs (8-second video):
 * - WAN Draft: $0.40 → 28 credits → $1.06 revenue → 165% margin
 * - Sora 2 Pro: $2.80 → 112 credits → $4.26 revenue → 52% margin
 * - Veo 3: $4.80 → 192 credits → $7.30 revenue → 52% margin
 *
 * User Experience Targets (Explorer $19/500 credits):
 * - 17 WAN Draft previews
 * - 4 Sora 2 Pro videos
 * - 2 Veo 3 videos
 */
export const VIDEO_CREDITS_PER_SECOND = {
  // WAN Video - Workflow backbone, most used
  // API: $0.05/sec (480p fast)
  [VIDEO_MODELS.DRAFT]: 3.5, // 28 credits/8s, 165% margin
  [VIDEO_MODELS.DRAFT_I2V]: 3.5, // Image-to-video fast
  [VIDEO_MODELS.DRAFT_I2V_LEGACY]: 3.5, // Wan 2.2 i2v fast
  [VIDEO_MODELS.DRAFT_I2V_WAN_2_5]: 3.5, // Wan 2.5 i2v

  // WAN Pro - Higher quality previews
  // API: $0.09/sec (720p)
  [VIDEO_MODELS.PRO]: 5, // 40 credits/8s, 110% margin

  // MiniMax Hailuo - Budget production option
  // API: $0.045/sec
  [VIDEO_MODELS.TIER_1]: 4, // 32 credits/8s, 238% margin

  // Kling v2.1 - Mid-tier production
  // API: $0.07/sec
  [VIDEO_MODELS.KLING_V2_1]: 5, // 40 credits/8s, 170% margin

  // Luma Ray3 - HDR/cinematic
  // API: $0.14/sec
  [VIDEO_MODELS.LUMA_RAY3]: 7, // 56 credits/8s, 90% margin

  // OpenAI Sora 2 - Flagship standard
  // API: $0.10/sec
  [VIDEO_MODELS.SORA_2]: 6, // 48 credits/8s, 128% margin

  // OpenAI Sora 2 Pro - Flagship premium
  // API: $0.35/sec average
  [VIDEO_MODELS.SORA_2_PRO]: 14, // 112 credits/8s, 52% margin

  // Google Veo 3 - Premium with audio
  // API: $0.60/sec average
  [VIDEO_MODELS.VEO_3]: 24, // 192 credits/8s, 52% margin

  // Veo alias
  [VIDEO_MODELS.TIER_2]: 24, // Same as VEO_3

  // Mochi/Artistic - Style-focused
  // API: $0.10/sec estimated
  [VIDEO_MODELS.ARTISTIC]: 6, // 48 credits/8s, 128% margin
} as const;

/**
 * Default credits per second for unknown models
 * Set conservatively to protect margins
 */
export const DEFAULT_VIDEO_CREDITS_PER_SECOND = 10;

/**
 * Default video duration in seconds (used when duration not specified)
 */
export const DEFAULT_VIDEO_DURATION_SECONDS = 8;

/**
 * Get the credit cost for a video generation
 *
 * @param modelId - The video model identifier
 * @param durationSeconds - Duration of the video in seconds (defaults to 8)
 * @returns Total credits required for the generation
 */
export function getVideoCost(modelId?: string, durationSeconds?: number): number {
  const duration = durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS;
  const creditsPerSecond = getVideoCreditsPerSecond(modelId);
  return Math.ceil(creditsPerSecond * duration);
}

/**
 * Get the credits-per-second rate for a video model
 * Useful for displaying pricing to users before generation
 *
 * @param modelId - The video model identifier
 * @returns Credits charged per second for this model
 */
export function getVideoCreditsPerSecond(modelId?: string): number {
  if (!modelId) return DEFAULT_VIDEO_CREDITS_PER_SECOND;
  return (
    VIDEO_CREDITS_PER_SECOND[modelId as keyof typeof VIDEO_CREDITS_PER_SECOND] ??
    DEFAULT_VIDEO_CREDITS_PER_SECOND
  );
}

/**
 * Get estimated cost breakdown for UI display
 *
 * @param modelId - The video model identifier
 * @param durationSeconds - Duration of the video in seconds
 * @returns Object with cost details for display
 */
export function getVideoCostBreakdown(modelId?: string, durationSeconds?: number) {
  const duration = durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS;
  const creditsPerSecond = getVideoCreditsPerSecond(modelId);
  const totalCredits = Math.ceil(creditsPerSecond * duration);

  return {
    creditsPerSecond,
    duration,
    totalCredits,
    modelId: modelId ?? 'unknown',
  };
}

// Legacy export for backwards compatibility during transition
export const VIDEO_GENERATION_COSTS = VIDEO_CREDITS_PER_SECOND;
export const DEFAULT_VIDEO_COST = DEFAULT_VIDEO_CREDITS_PER_SECOND * DEFAULT_VIDEO_DURATION_SECONDS;
