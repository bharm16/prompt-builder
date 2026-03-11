import type { LockedSpan } from '@/features/prompt-optimizer/types';
import type { CapabilityValues } from '@shared/capabilities';
import type { I2VOptimizationResult } from '@/features/prompt-optimizer/types/i2v';

export interface CompilationIntentLockState {
  passed: boolean;
  repaired: boolean;
  skippedRepair: boolean;
  warning?: string;
  required: { subject: string | null; action: string | null };
}

export interface CompilationState {
  status: 'compiled' | 'generic-fallback' | 'compile-skipped';
  usedFallback: boolean;
  reason?: string;
  sourceKind: 'artifact' | 'artifactKey' | 'prompt';
  structuredArtifactReused: boolean;
  analyzerBypassed: boolean;
  compiledFor: string | null;
  intentLock?: CompilationIntentLockState;
}

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

export interface OptimizeResult {
  prompt: string;
  optimizedPrompt?: string;
  inputMode?: 't2v' | 'i2v';
  i2v?: I2VOptimizationResult;
  artifactKey?: string;
  compilation?: CompilationState;
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
  compilation?: CompilationState;
  metadata?: Record<string, unknown>;
  targetModel?: string;
}
