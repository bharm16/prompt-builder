import { z } from 'zod';
import {
  CONVERGENCE_ERROR_CODES,
  CONVERGENCE_STEPS,
  CAMERA_MOTION_CATEGORIES,
  DIMENSION_TYPES,
  DIRECTIONS,
  SESSION_STATUSES,
  STARTING_POINT_MODES,
  type AbandonSessionResponse,
  type CameraPath,
  type CameraMotionCategory,
  type CameraTransform,
  type ConvergenceApiError,
  type ConvergenceErrorCode,
  type ConvergenceSession,
  type ConvergenceStep,
  type DimensionType,
  type Direction,
  type GenerateFinalFrameResponse,
  type FinalizeSessionResponse,
  type GenerateCameraMotionResponse,
  type GenerateSubjectMotionResponse,
  type GeneratedImage,
  type LockedDimension,
  type RegenerateResponse,
  type SetStartingPointResponse,
  type StartingPointMode,
  type UploadImageResponse,
  type Rotation3D,
  type SelectOptionResponse,
  type SessionStatus,
  type StartSessionResponse,
  type Position3D,
} from '../types';

const DEFAULT_ASPECT_RATIO = '16:9';

export const ConvergenceErrorCodeSchema: z.ZodType<ConvergenceErrorCode> = z.enum(
  CONVERGENCE_ERROR_CODES
);

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

const DirectionSchema: z.ZodType<Direction> = z.enum(DIRECTIONS);

const DimensionTypeSchema: z.ZodType<DimensionType> = z.enum(DIMENSION_TYPES);

const ConvergenceStepSchema: z.ZodType<ConvergenceStep> = z.enum(CONVERGENCE_STEPS);

const SessionStatusSchema: z.ZodType<SessionStatus> = z.enum(SESSION_STATUSES);

const StartingPointModeSchema: z.ZodType<StartingPointMode> = z.enum(STARTING_POINT_MODES);

const CameraMotionCategorySchema: z.ZodType<CameraMotionCategory> = z.enum(
  CAMERA_MOTION_CATEGORIES
);

const Position3DSchema: z.ZodType<Position3D> = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const Rotation3DSchema: z.ZodType<Rotation3D> = z.object({
  pitch: z.number(),
  yaw: z.number(),
  roll: z.number(),
});

const CameraTransformSchema: z.ZodType<CameraTransform> = z.object({
  position: Position3DSchema,
  rotation: Rotation3DSchema,
});

const CameraPathSchema: z.ZodType<CameraPath> = z.object({
  id: z.string(),
  label: z.string(),
  category: CameraMotionCategorySchema,
  start: CameraTransformSchema,
  end: CameraTransformSchema,
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
  aspectRatio: z.string().optional().default(DEFAULT_ASPECT_RATIO),
  direction: DirectionSchema.nullable(),
  lockedDimensions: z.array(LockedDimensionSchema),
  currentStep: ConvergenceStepSchema,
  generatedImages: z.array(GeneratedImageSchema),
  imageHistory: z.record(z.string(), z.array(GeneratedImageSchema)),
  regenerationCounts: z.record(z.string(), z.number()),
  startingPointMode: StartingPointModeSchema.nullable(),
  finalFrameUrl: z.string().nullable(),
  finalFrameRegenerations: z.number(),
  uploadedImageUrl: z.string().nullable(),
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
    currentDimension: z.union([z.literal('starting_point'), z.literal('direction')]),
    options: z.array(DirectionOptionSchema).optional(),
    estimatedCost: z.number(),
  })
  .passthrough();

const SELECT_OPTION_DIMENSIONS = [...DIMENSION_TYPES, 'subject_motion', 'final_frame'] as const;
const SelectOptionDimensionSchema: z.ZodType<SelectOptionResponse['currentDimension']> = z.enum(
  SELECT_OPTION_DIMENSIONS
);

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
    inputMode: z.enum(['i2v', 't2v']),
    startImageUrl: z.string().nullable(),
  })
  .passthrough();

export const SetStartingPointResponseSchema: z.ZodType<SetStartingPointResponse> = z
  .object({
    sessionId: z.string(),
    mode: StartingPointModeSchema,
    finalFrameUrl: z.string().optional(),
    nextStep: ConvergenceStepSchema,
    creditsConsumed: z.number(),
    images: z.array(GeneratedImageSchema).optional(),
    options: z.array(DirectionOptionSchema).optional(),
  })
  .passthrough();

export const GenerateFinalFrameResponseSchema: z.ZodType<GenerateFinalFrameResponse> = z
  .object({
    sessionId: z.string(),
    finalFrameUrl: z.string(),
    prompt: z.string(),
    remainingRegenerations: z.number(),
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

export const UploadImageResponseSchema: z.ZodType<UploadImageResponse> = z
  .object({
    url: z.string().min(1),
  })
  .passthrough();

export const AbandonSessionResponseSchema: z.ZodType<AbandonSessionResponse> = z
  .object({
    sessionId: z.string(),
    status: z.literal('abandoned'),
    imagesDeleted: z.boolean(),
  })
  .passthrough();
