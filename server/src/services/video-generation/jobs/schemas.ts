import { z } from 'zod';
import { VIDEO_JOB_ERROR_CATEGORIES, VIDEO_JOB_ERROR_STAGES, VIDEO_JOB_STATUSES } from './types';

export const VideoGenerationOptionsSchema = z.object({
  model: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16', '21:9', '1:1']).optional(),
  numFrames: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  negativePrompt: z.string().optional(),
  promptExtend: z.boolean().optional(),
  startImage: z.string().optional(),
  endImage: z.string().optional(),
  referenceImages: z
    .array(
      z.object({
        url: z.string(),
        type: z.enum(['asset', 'style']),
      })
    )
    .max(3)
    .optional(),
  extendVideoUrl: z.string().optional(),
  inputReference: z.string().optional(),
  seconds: z.enum(['4', '5', '6', '8', '10', '12']).optional(),
  size: z.string().optional(),
  seed: z.number().optional(),
  style_reference: z.string().optional(),
  style_reference_weight: z.number().optional(),
  characterAssetId: z.string().optional(),
  autoKeyframe: z.boolean().optional(),
  faceSwapAlreadyApplied: z.boolean().optional(),
  faceSwapUrl: z.string().optional(),
}).partial();

export const VideoJobRequestSchema = z.object({
  prompt: z.string().min(1),
  options: VideoGenerationOptionsSchema,
});

export const VideoJobResultSchema = z.object({
  assetId: z.string(),
  videoUrl: z.string(),
  contentType: z.string(),
  inputMode: z.enum(['t2v', 'i2v']).optional(),
  startImageUrl: z.string().optional(),
  storagePath: z.string().optional(),
  viewUrl: z.string().optional(),
  viewUrlExpiresAt: z.string().optional(),
  sizeBytes: z.number().optional(),
});

export const VideoJobErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  category: z.enum(VIDEO_JOB_ERROR_CATEGORIES).optional(),
  retryable: z.boolean().optional(),
  stage: z.enum(VIDEO_JOB_ERROR_STAGES).optional(),
  provider: z.string().optional(),
  attempt: z.number().int().positive().optional(),
});

export const VideoJobRecordSchema = z.object({
  status: z.enum(VIDEO_JOB_STATUSES),
  userId: z.string(),
  request: VideoJobRequestSchema,
  creditsReserved: z.number().nonnegative(),
  attempts: z.number().int().nonnegative().optional(),
  maxAttempts: z.number().int().positive().optional(),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  completedAtMs: z.number().optional(),
  result: VideoJobResultSchema.optional(),
  error: VideoJobErrorSchema.optional(),
  workerId: z.string().optional(),
  leaseExpiresAtMs: z.number().optional(),
  lastHeartbeatAtMs: z.number().optional(),
  releasedAtMs: z.number().optional(),
  releaseReason: z.string().optional(),
});
