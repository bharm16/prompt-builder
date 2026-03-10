import type { LockedSpan } from '@/features/prompt-optimizer/types';
import type { CapabilityValues } from '@shared/capabilities';
import type { I2VOptimizationResult } from '@/features/prompt-optimizer/types/i2v';

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
  metadata?: Record<string, unknown>;
}

export interface CompileOptions {
  prompt: string;
  targetModel: string;
  context?: unknown | null;
  signal?: AbortSignal;
}

export interface CompileResult {
  compiledPrompt: string;
  metadata?: Record<string, unknown>;
  targetModel?: string;
}
