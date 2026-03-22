import type { LockedSpan } from '@/features/prompt-optimizer/types';
import type { CapabilityValues } from '@shared/capabilities';
import type { I2VOptimizationResult } from '@/features/prompt-optimizer/types/i2v';

// Re-export shared contract types so existing consumer imports keep working.
export type {
  CompilationIntentLockState,
  CompilationState,
  OptimizeResponse,
  CompileResponse,
} from '@shared/schemas/optimization.schemas';

// Import the schemas for runtime validation at the fetch boundary.
export {
  OptimizeResponseSchema,
  CompileResponseSchema,
} from '@shared/schemas/optimization.schemas';

// ---------------------------------------------------------------------------
// Client-only request types (not shared — these are input shapes the client
// constructs before sending to the server).
// ---------------------------------------------------------------------------

export interface OptimizeOptions {
  prompt: string;
  mode: string;
  targetModel?: string;
  context?: unknown | null;
  brainstormContext?: unknown | null;
  generationParams?: CapabilityValues;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  startImage?: string;
  sourcePrompt?: string;
  constraintMode?: 'strict' | 'flexible' | 'transform';
  signal?: AbortSignal;
}

/**
 * Wire-format response from POST /api/optimize.
 *
 * This extends the shared schema type with the I2V result which has a
 * feature-local type definition on the client side.
 */
export interface OptimizeResult {
  prompt: string;
  optimizedPrompt?: string;
  inputMode?: 't2v' | 'i2v';
  i2v?: I2VOptimizationResult;
  artifactKey?: string;
  compilation?: import('@shared/schemas/optimization.schemas').CompilationState;
  metadata?: Record<string, unknown>;
}

export interface CompileOptions {
  prompt?: string;
  artifactKey?: string;
  targetModel: string;
  context?: unknown | null;
  signal?: AbortSignal;
}

export interface CompileResult {
  compiledPrompt: string;
  artifactKey?: string;
  compilation?: import('@shared/schemas/optimization.schemas').CompilationState;
  metadata?: Record<string, unknown>;
  targetModel?: string;
}
