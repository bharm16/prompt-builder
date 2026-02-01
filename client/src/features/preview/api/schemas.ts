import { z } from 'zod';
import type {
  GeneratePreviewResponse,
  GenerateStoryboardPreviewResponse,
  GenerateVideoResponse,
  FaceSwapPreviewResponse,
  MediaViewUrlResponse,
  UploadPreviewImageResponse,
  VideoJobStatusResponse,
} from './previewApi';

const PreviewMetadataSchema = z.object({
  aspectRatio: z.string(),
  model: z.string(),
  duration: z.number(),
  generatedAt: z.string(),
});

export const GeneratePreviewResponseSchema: z.ZodType<GeneratePreviewResponse> = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        imageUrl: z.string(),
        storagePath: z.string().optional(),
        viewUrl: z.string().optional(),
        viewUrlExpiresAt: z.string().optional(),
        sizeBytes: z.number().optional(),
        metadata: PreviewMetadataSchema,
      })
      .optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const UploadPreviewImageResponseSchema: z.ZodType<UploadPreviewImageResponse> = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        imageUrl: z.string(),
        storagePath: z.string().optional(),
        viewUrl: z.string().optional(),
        viewUrlExpiresAt: z.string().optional(),
        sizeBytes: z.number().optional(),
        contentType: z.string().optional(),
      })
      .optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const GenerateStoryboardPreviewResponseSchema: z.ZodType<GenerateStoryboardPreviewResponse> = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        imageUrls: z.array(z.string()),
        storagePaths: z.array(z.string()).optional(),
        deltas: z.array(z.string()),
        baseImageUrl: z.string(),
      })
      .optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const MediaViewUrlResponseSchema: z.ZodType<MediaViewUrlResponse> = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        viewUrl: z.string(),
      })
      .optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const FaceSwapPreviewResponseSchema: z.ZodType<FaceSwapPreviewResponse> = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        faceSwapUrl: z.string(),
        creditsDeducted: z.number(),
      })
      .optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const GenerateVideoResponseSchema: z.ZodType<GenerateVideoResponse> = z
  .object({
    success: z.boolean(),
    videoUrl: z.string().optional(),
    storagePath: z.string().optional(),
    viewUrl: z.string().optional(),
    viewUrlExpiresAt: z.string().optional(),
    sizeBytes: z.number().optional(),
    inputMode: z.enum(['t2v', 'i2v']).optional(),
    startImageUrl: z.string().optional(),
    jobId: z.string().optional(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    creditsReserved: z.number().optional(),
    creditsDeducted: z.number().optional(),
    keyframeGenerated: z.boolean().optional(),
    keyframeUrl: z.string().nullish(),
    faceSwapApplied: z.boolean().optional(),
    faceSwapUrl: z.string().nullish(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const VideoJobStatusResponseSchema: z.ZodType<VideoJobStatusResponse> = z
  .object({
    success: z.boolean(),
    jobId: z.string(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']),
    videoUrl: z.string().optional(),
    assetId: z.string().optional(),
    contentType: z.string().optional(),
    storagePath: z.string().optional(),
    viewUrl: z.string().optional(),
    viewUrlExpiresAt: z.string().optional(),
    sizeBytes: z.number().optional(),
    inputMode: z.enum(['t2v', 'i2v']).optional(),
    startImageUrl: z.string().optional(),
    creditsReserved: z.number().optional(),
    creditsDeducted: z.number().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();
