/**
 * Zod schemas for prompt-optimization API contracts.
 *
 * Canonical source — both client and server import from here.
 * `.passthrough()` allows forward-compatible additions without breaking
 * existing consumers.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums / atoms
// ---------------------------------------------------------------------------

export const CompilationStatusSchema = z.enum([
  "compiled",
  "generic-fallback",
  "compile-skipped",
]);

export const CompileSourceKindSchema = z.enum([
  "artifact",
  "artifactKey",
  "prompt",
]);

export const InputModeSchema = z.enum(["t2v", "i2v"]);

export const I2VConstraintModeSchema = z.enum([
  "strict",
  "flexible",
  "transform",
]);

export const LockStatusSchema = z.enum(["hard", "soft", "unlocked"]);

export const LockableCategorySchema = z.enum([
  "subject.identity",
  "subject.appearance",
  "shot.type",
  "shot.angle",
  "lighting",
  "environment",
  "color",
  "camera.movement",
]);

export const LockMapSchema = z
  .object({
    "subject.identity": LockStatusSchema,
    "subject.appearance": LockStatusSchema,
    "shot.type": LockStatusSchema,
    "shot.angle": LockStatusSchema,
    lighting: LockStatusSchema,
    environment: LockStatusSchema,
    color: LockStatusSchema,
    "camera.movement": LockStatusSchema,
  })
  .passthrough();

export const ConflictWarningSchema = z
  .object({
    category: LockableCategorySchema,
    userSaid: z.string(),
    imageShows: z.string(),
    severity: z.enum(["info", "warning", "blocked"]),
  })
  .passthrough();

export const I2VOptimizationResultSchema = z
  .object({
    prompt: z.string(),
    conflicts: z.array(ConflictWarningSchema),
    appliedMode: I2VConstraintModeSchema,
    lockMap: LockMapSchema,
    extractedMotion: z
      .object({
        subjectAction: z.string().nullable(),
        cameraMovement: z.string().nullable(),
        pacing: z.string().nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export type I2VOptimizationResult = z.infer<typeof I2VOptimizationResultSchema>;

// ---------------------------------------------------------------------------
// Intent lock state (attached to compilation metadata)
// ---------------------------------------------------------------------------

export const CompilationIntentLockStateSchema = z
  .object({
    passed: z.boolean(),
    repaired: z.boolean(),
    skippedRepair: z.boolean(),
    warning: z.string().optional(),
    required: z.object({
      subject: z.string().nullable(),
      action: z.string().nullable(),
    }),
  })
  .passthrough();

export type CompilationIntentLockState = z.infer<
  typeof CompilationIntentLockStateSchema
>;

// ---------------------------------------------------------------------------
// Compilation state
// ---------------------------------------------------------------------------

export const CompilationStateSchema = z
  .object({
    status: CompilationStatusSchema,
    usedFallback: z.boolean(),
    reason: z.string().optional(),
    sourceKind: CompileSourceKindSchema,
    structuredArtifactReused: z.boolean(),
    analyzerBypassed: z.boolean(),
    compiledFor: z.string().nullable(),
    intentLock: CompilationIntentLockStateSchema.optional(),
  })
  .passthrough();

export type CompilationState = z.infer<typeof CompilationStateSchema>;

// ---------------------------------------------------------------------------
// Optimize response (wire format from POST /api/optimize)
// ---------------------------------------------------------------------------

export const OptimizeResponseSchema = z
  .object({
    prompt: z.string(),
    optimizedPrompt: z.string().optional(),
    inputMode: InputModeSchema.optional(),
    artifactKey: z.string().optional(),
    compilation: CompilationStateSchema.optional(),
    i2v: I2VOptimizationResultSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type OptimizeResponse = z.infer<typeof OptimizeResponseSchema>;

// ---------------------------------------------------------------------------
// Compile response (wire format from POST /api/optimize-compile)
// ---------------------------------------------------------------------------

export const CompileResponseSchema = z
  .object({
    compiledPrompt: z.string(),
    artifactKey: z.string().optional(),
    compilation: CompilationStateSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    targetModel: z.string().optional(),
  })
  .passthrough();

export type CompileResponse = z.infer<typeof CompileResponseSchema>;
