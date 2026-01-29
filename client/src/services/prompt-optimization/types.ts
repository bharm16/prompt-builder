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

export interface OptimizeWithStreamingOptions extends OptimizeOptions {
  onDraft?: ((draft: string) => void) | null;
  onSpans?: ((spans: unknown[], source: string, meta?: unknown) => void) | null;
  onRefined?: ((refined: string, metadata?: Record<string, unknown>) => void) | null;
  onError?: ((error: Error) => void) | null;
}

export interface OptimizeWithStreamingResult {
  draft: string;
  refined: string;
  spans: unknown[];
  metadata: Record<string, unknown> | null;
  usedFallback: boolean;
}

export interface StreamWithFetchOptions {
  url: string;
  method: string;
  body: Record<string, unknown>;
  onMessage: (event: string, data: Record<string, unknown>) => void;
  onError: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

export interface OfflineResult {
  draft: string;
  refined: string;
  spans: unknown[];
  metadata: Record<string, unknown>;
  usedFallback: boolean;
}
