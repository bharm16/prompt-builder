import { z } from 'zod';
import type {
  CameraPath,
  ConvergenceApiError,
  ConvergenceErrorCode,
  ConvergenceSession,
  ConvergenceStep,
  DimensionType,
  Direction,
  FinalizeSessionResponse,
  GenerateCameraMotionResponse,
  GenerateSubjectMotionResponse,
  GeneratedImage,
  LockedDimension,
  RegenerateResponse,
  SelectOptionResponse,
  SessionStatus,
  StartSessionResponse,
  Position3D,
} from '../types';

const ERROR_CODES = [
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'ACTIVE_SESSION_EXISTS',
  'INSUFFICIENT_CREDITS',
  'REGENERATION_LIMIT_EXCEEDED',
  'DEPTH_ESTIMATION_FAILED',
  'IMAGE_GENERATION_FAILED',
  'VIDEO_GENERATION_FAILED',
  'INCOMPLETE_SESSION',
  'UNAUTHORIZED',
  'INVALID_REQUEST',
] as const;

export const ConvergenceErrorCodeSchema: z.ZodType<ConvergenceErrorCode> = z.enum(ERROR_CODES);

export const ConvergenceApiErrorSchema: z.ZodType<ConvergenceApiError> = z
  .object({
    code: ConvergenceErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ConvergenceApiErrorResponseSchema = z
  .object({
    error: ConvergenceErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export function parseConvergenceApiError(data: unknown): ConvergenceApiError | null {
  const directResult = ConvergenceApiErrorSchema.safeParse(data);
  if (directResult.success) {
    return directResult.data;
  }

  const responseResult = ConvergenceApiErrorResponseSchema.safeParse(data);
  if (responseResult.success) {
    return {
      code: responseResult.data.error,
      message: responseResult.data.message,
      details: responseResult.data.details,
    };
  }

  if (typeof data === 'object' && data !== null) {
    const errorField = (data as { error?: unknown }).error;
    if (typeof errorField === 'string') {
      const messageField = (data as { message?: unknown }).message;
      return {
        code: 'INVALID_REQUEST',
        message: typeof messageField === 'string' ? messageField : errorField,
      };
    }
  }

  return null;
}

const DirectionSchema: z.ZodType<Direction> = z.enum([
  'cinematic',
  'social',
  'artistic',
  'documentary',
]);

const DimensionTypeSchema: z.ZodType<DimensionType> = z.enum([
  'mood',
  'framing',
  'lighting',
  'camera_motion',
]);

const ConvergenceStepSchema: z.ZodType<ConvergenceStep> = z.enum([
  'intent',
  'direction',
  'mood',
  'framing',
  'lighting',
  'camera_motion',
  'subject_motion',
  'preview',
  'complete',
]);

const SessionStatusSchema: z.ZodType<SessionStatus> = z.enum([
  'active',
  'completed',
  'abandoned',
]);

const Position3DSchema: z.ZodType<Position3D> = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const CameraPathSchema: z.ZodType<CameraPath> = z.object({
  id: z.string(),
  label: z.string(),
  start: Position3DSchema,
  end: Position3DSchema,
  duration: z.number(),
});

const GeneratedImageSchema: z.ZodType<GeneratedImage> = z.object({
  id: z.string(),
  url: z.string().min(1),
  dimension: z.union([DimensionTypeSchema, z.literal('direction')]),
  optionId: z.string(),
  prompt: z.string(),
  generatedAt: z.coerce.date(),
});

const LockedDimensionSchema: z.ZodType<LockedDimension> = z.object({
  type: DimensionTypeSchema,
  optionId: z.string(),
  label: z.string(),
  promptFragments: z.array(z.string()),
});

export const ConvergenceSessionSchema: z.ZodType<ConvergenceSession> = z.object({
  id: z.string(),
  userId: z.string(),
  intent: z.string(),
  direction: DirectionSchema.nullable(),
  lockedDimensions: z.array(LockedDimensionSchema),
  currentStep: ConvergenceStepSchema,
  generatedImages: z.array(GeneratedImageSchema),
  imageHistory: z.record(z.string(), z.array(GeneratedImageSchema)),
  regenerationCounts: z.record(z.string(), z.number()),
  depthMapUrl: z.string().nullable(),
  cameraMotion: z.string().nullable(),
  subjectMotion: z.string().nullable(),
  finalPrompt: z.string().nullable(),
  status: SessionStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const DirectionOptionSchema = z.object({
  id: DirectionSchema,
  label: z.string(),
});

export const StartSessionResponseSchema: z.ZodType<StartSessionResponse> = z
  .object({
    sessionId: z.string(),
    images: z.array(GeneratedImageSchema),
    currentDimension: z.literal('direction'),
    options: z.array(DirectionOptionSchema),
    estimatedCost: z.number(),
  })
  .passthrough();

const SelectOptionDimensionSchema: z.ZodType<SelectOptionResponse['currentDimension']> = z.enum([
  'mood',
  'framing',
  'lighting',
  'camera_motion',
  'subject_motion',
]);

export const SelectOptionResponseSchema: z.ZodType<SelectOptionResponse> = z
  .object({
    sessionId: z.string(),
    images: z.array(GeneratedImageSchema),
    currentDimension: SelectOptionDimensionSchema,
    lockedDimensions: z.array(LockedDimensionSchema),
    options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
    creditsConsumed: z.number(),
    direction: DirectionSchema.optional(),
  })
  .passthrough();

export const RegenerateResponseSchema: z.ZodType<RegenerateResponse> = z
  .object({
    sessionId: z.string(),
    images: z.array(GeneratedImageSchema),
    remainingRegenerations: z.number(),
    creditsConsumed: z.number(),
  })
  .passthrough();

export const GenerateCameraMotionResponseSchema: z.ZodType<GenerateCameraMotionResponse> = z
  .object({
    sessionId: z.string(),
    depthMapUrl: z.string().nullable(),
    cameraPaths: z.array(CameraPathSchema),
    fallbackMode: z.boolean(),
    creditsConsumed: z.number(),
  })
  .passthrough();

export const SelectCameraMotionResponseSchema = z
  .object({
    sessionId: z.string(),
    cameraMotionId: z.string(),
  })
  .passthrough();

export const GenerateSubjectMotionResponseSchema: z.ZodType<GenerateSubjectMotionResponse> = z
  .object({
    sessionId: z.string(),
    videoUrl: z.string(),
    prompt: z.string(),
    creditsConsumed: z.number(),
  })
  .passthrough();

export const FinalizeSessionResponseSchema: z.ZodType<FinalizeSessionResponse> = z
  .object({
    sessionId: z.string(),
    finalPrompt: z.string(),
    lockedDimensions: z.array(LockedDimensionSchema),
    previewImageUrl: z.string(),
    cameraMotion: z.string(),
    subjectMotion: z.string(),
    totalCreditsConsumed: z.number(),
    generationCosts: z.record(z.string(), z.number()),
  })
  .passthrough();

export const ActiveSessionResponseSchema = z
  .object({
    session: ConvergenceSessionSchema.nullable(),
  })
  .passthrough();
