import { z } from 'zod';

const GenerationModeSchema = z.enum(['continuity', 'standard']);
const ContinuityModeSchema = z.enum([
  'frame-bridge',
  'style-match',
  'native',
  'none',
]);

const ResolutionSchema = z.object({
  width: z.number(),
  height: z.number(),
});

const StyleReferenceSchema = z
  .object({
    id: z.string(),
    sourceVideoId: z.string().optional(),
    sourceFrameIndex: z.number().optional(),
    frameUrl: z.string(),
    frameTimestamp: z.number(),
    resolution: ResolutionSchema,
    aspectRatio: z.string(),
    analysisMetadata: z
      .object({
        dominantColors: z.array(z.string()),
        lightingDescription: z.string(),
        moodDescription: z.string(),
        confidence: z.number(),
      })
      .optional(),
  })
  .passthrough();

const FrameBridgeSchema = z
  .object({
    id: z.string(),
    sourceVideoId: z.string(),
    sourceShotId: z.string(),
    frameUrl: z.string(),
    framePosition: z.enum(['first', 'last', 'representative']),
    frameTimestamp: z.number(),
    resolution: ResolutionSchema,
    aspectRatio: z.string(),
    extractedAt: z.string(),
  })
  .passthrough();

const SeedInfoSchema = z
  .object({
    seed: z.number(),
    provider: z.string(),
    modelId: z.string(),
    extractedAt: z.string(),
  })
  .passthrough();

const CameraSchema = z
  .object({
    yaw: z.number().optional(),
    pitch: z.number().optional(),
    roll: z.number().optional(),
    dolly: z.number().optional(),
  })
  .partial();

const ContinuityShotSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    sequenceIndex: z.number(),
    userPrompt: z.string(),
    generationMode: GenerationModeSchema.optional(),
    continuityMode: ContinuityModeSchema,
    styleStrength: z.number(),
    styleReferenceId: z.string().nullable(),
    styleReference: StyleReferenceSchema.optional(),
    frameBridge: FrameBridgeSchema.optional(),
    characterAssetId: z.string().optional(),
    faceStrength: z.number().optional(),
    camera: CameraSchema.optional(),
    modelId: z.string(),
    seedInfo: SeedInfoSchema.optional(),
    inheritedSeed: z.number().optional(),
    videoAssetId: z.string().optional(),
    generatedKeyframeUrl: z.string().optional(),
    styleTransferApplied: z.boolean().optional(),
    styleDegraded: z.boolean().optional(),
    styleDegradedReason: z.string().optional(),
    sceneProxyRenderUrl: z.string().optional(),
    continuityMechanismUsed: z.string().optional(),
    styleScore: z.number().optional(),
    identityScore: z.number().optional(),
    qualityScore: z.number().optional(),
    retryCount: z.number().optional(),
    status: z.enum([
      'draft',
      'generating-keyframe',
      'generating-video',
      'completed',
      'failed',
    ]),
    error: z.string().optional(),
    createdAt: z.string(),
    generatedAt: z.string().optional(),
  })
  .passthrough();

const ContinuitySessionSettingsSchema = z
  .object({
    generationMode: GenerationModeSchema,
    defaultContinuityMode: ContinuityModeSchema,
    defaultStyleStrength: z.number(),
    defaultModel: z.string(),
    autoExtractFrameBridge: z.boolean(),
    useCharacterConsistency: z.boolean(),
    useSceneProxy: z.boolean().optional(),
    autoRetryOnFailure: z.boolean().optional(),
    maxRetries: z.number().optional(),
    qualityThresholds: z
      .object({
        style: z.number(),
        identity: z.number(),
      })
      .optional(),
  })
  .passthrough();

const SceneProxySchema = z
  .object({
    id: z.string(),
    proxyType: z.string(),
    referenceFrameUrl: z.string(),
    depthMapUrl: z.string().optional(),
    status: z.enum(['ready', 'failed', 'building']),
    createdAt: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

const ContinuitySessionSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    primaryStyleReference: StyleReferenceSchema.nullable().optional(),
    sceneProxy: SceneProxySchema.nullable().optional(),
    shots: z.array(ContinuityShotSchema),
    defaultSettings: ContinuitySessionSettingsSchema,
    status: z.enum(['active', 'completed', 'archived']),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const ContinuityApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export {
  ContinuitySessionSchema,
  ContinuitySessionSettingsSchema,
  ContinuityShotSchema,
  FrameBridgeSchema,
  SeedInfoSchema,
  StyleReferenceSchema,
};
