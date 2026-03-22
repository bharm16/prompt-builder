/**
 * Zod schemas for prompt-optimization API contracts.
 *
 * Canonical source — both client and server import from here.
 * `.passthrough()` allows forward-compatible additions without breaking
 * existing consumers.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums / atoms
// ---------------------------------------------------------------------------

export const CompilationStatusSchema = z.enum([
  'compiled',
  'generic-fallback',
  'compile-skipped',
]);

export const CompileSourceKindSchema = z.enum([
  'artifact',
  'artifactKey',
  'prompt',
]);

export const InputModeSchema = z.enum(['t2v', 'i2v']);

export const I2VConstraintModeSchema = z.enum([
  'strict',
  'flexible',
  'transform',
]);

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
    i2v: z.record(z.string(), z.unknown()).optional(),
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
