/**
 * Zod schemas mirroring shared/types/session.ts.
 *
 * These are used exclusively in contract tests to ensure that actual server
 * payloads match the TypeScript interface declarations.  The `.passthrough()`
 * call allows forward-compatible additions without breaking the contract.
 */
import { z } from 'zod';

export const SessionStatusSchema = z.enum(['active', 'completed', 'archived']);

export const SessionPromptKeyframeSourceSchema = z.enum(['upload', 'library', 'generation', 'asset']);

export const SessionPromptKeyframeSchema = z
  .object({
    id: z.string().optional(),
    url: z.string(),
    source: SessionPromptKeyframeSourceSchema.optional(),
    assetId: z.string().optional(),
    storagePath: z.string().optional(),
    viewUrlExpiresAt: z.string().optional(),
  })
  .passthrough();

export const SessionPromptVersionEditSchema = z
  .object({
    timestamp: z.string(),
    delta: z.number().optional(),
    source: z.enum(['manual', 'suggestion', 'unknown']).optional(),
  })
  .passthrough();

export const SessionPromptVersionPreviewSchema = z
  .object({
    generatedAt: z.string(),
    imageUrl: z.string().nullable().optional(),
    aspectRatio: z.string().nullable().optional(),
    storagePath: z.string().nullable().optional(),
    assetId: z.string().nullable().optional(),
    viewUrlExpiresAt: z.string().nullable().optional(),
  })
  .passthrough();

export const SessionPromptVersionVideoSchema = z
  .object({
    generatedAt: z.string(),
    videoUrl: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    generationParams: z.record(z.string(), z.unknown()).nullable().optional(),
    storagePath: z.string().nullable().optional(),
    assetId: z.string().nullable().optional(),
    viewUrlExpiresAt: z.string().nullable().optional(),
  })
  .passthrough();

export const SessionPromptVersionEntrySchema = z
  .object({
    versionId: z.string(),
    label: z.string().optional(),
    signature: z.string(),
    prompt: z.string(),
    timestamp: z.string(),
    highlights: z.record(z.string(), z.unknown()).optional(),
    editCount: z.number().optional(),
    edits: z.array(SessionPromptVersionEditSchema).optional(),
    preview: SessionPromptVersionPreviewSchema.optional(),
    video: SessionPromptVersionVideoSchema.optional(),
    generations: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const SessionPromptSchema = z
  .object({
    uuid: z.string().optional(),
    title: z.string().nullable().optional(),
    input: z.string(),
    output: z.string(),
    score: z.number().nullable().optional(),
    mode: z.string().optional(),
    targetModel: z.string().nullable().optional(),
    generationParams: z.record(z.string(), z.unknown()).nullable().optional(),
    keyframes: z.array(SessionPromptKeyframeSchema).nullable().optional(),
    brainstormContext: z.record(z.string(), z.unknown()).nullable().optional(),
    highlightCache: z.record(z.string(), z.unknown()).nullable().optional(),
    versions: z.array(SessionPromptVersionEntrySchema).optional(),
  })
  .passthrough();

export const SessionGenerationModeSchema = z.enum(['continuity', 'standard']);
export const SessionContinuityModeSchema = z.enum(['frame-bridge', 'style-match', 'native', 'none']);

export const SessionStyleReferenceSchema = z
  .object({
    id: z.string(),
    sourceVideoId: z.string().optional(),
    sourceFrameIndex: z.number().optional(),
    frameUrl: z.string(),
    frameTimestamp: z.number(),
    resolution: z.object({ width: z.number(), height: z.number() }),
    aspectRatio: z.string(),
    analysisMetadata: z
      .object({
        dominantColors: z.array(z.string()),
        lightingDescription: z.string(),
        moodDescription: z.string(),
        confidence: z.number(),
      })
      .optional(),
    extractedAt: z.string().optional(),
  })
  .passthrough();

export const SessionFrameBridgeSchema = z
  .object({
    id: z.string(),
    sourceVideoId: z.string(),
    sourceShotId: z.string(),
    frameUrl: z.string(),
    framePosition: z.enum(['first', 'last', 'representative']),
    frameTimestamp: z.number(),
    resolution: z.object({ width: z.number(), height: z.number() }),
    aspectRatio: z.string(),
    extractedAt: z.string(),
  })
  .passthrough();

export const SessionSeedInfoSchema = z
  .object({
    seed: z.number(),
    provider: z.string(),
    modelId: z.string(),
    extractedAt: z.string(),
  })
  .passthrough();

export const SessionContinuityShotSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    sequenceIndex: z.number(),
    userPrompt: z.string(),
    generationMode: SessionGenerationModeSchema.optional(),
    continuityMode: SessionContinuityModeSchema,
    styleStrength: z.number(),
    styleReferenceId: z.string().nullable(),
    styleReference: SessionStyleReferenceSchema.optional(),
    frameBridge: SessionFrameBridgeSchema.optional(),
    characterAssetId: z.string().optional(),
    faceStrength: z.number().optional(),
    camera: z
      .object({
        yaw: z.number().optional(),
        pitch: z.number().optional(),
        roll: z.number().optional(),
        dolly: z.number().optional(),
      })
      .optional(),
    modelId: z.string(),
    seedInfo: SessionSeedInfoSchema.optional(),
    inheritedSeed: z.number().optional(),
    videoAssetId: z.string().optional(),
    previewAssetId: z.string().optional(),
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
    status: z.enum(['draft', 'generating-keyframe', 'generating-video', 'completed', 'failed']),
    error: z.string().optional(),
    createdAt: z.string(),
    generatedAt: z.string().optional(),
    versions: z.array(SessionPromptVersionEntrySchema).optional(),
  })
  .passthrough();

export const SessionContinuitySettingsSchema = z
  .object({
    generationMode: SessionGenerationModeSchema,
    defaultContinuityMode: SessionContinuityModeSchema,
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

export const SessionSceneProxySchema = z
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

export const SessionContinuitySchema = z
  .object({
    shots: z.array(SessionContinuityShotSchema),
    primaryStyleReference: SessionStyleReferenceSchema.nullable().optional(),
    sceneProxy: SessionSceneProxySchema.nullable().optional(),
    settings: SessionContinuitySettingsSchema,
  })
  .passthrough();

export const SessionDtoSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: SessionStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    prompt: SessionPromptSchema.optional(),
    continuity: SessionContinuitySchema.optional(),
  })
  .passthrough();
