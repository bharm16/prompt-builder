export interface OptimizeOptions {
  prompt: string;
  mode: string;
  context?: unknown | null;
  brainstormContext?: unknown | null;
}

export interface OptimizeResult {
  optimizedPrompt: string;
}

export interface OptimizeWithFallbackOptions extends OptimizeOptions {
  onDraft?: (draft: string) => void;
  onSpans?: (spans: unknown[], source: string, meta?: unknown) => void;
  onRefined?: (refined: string, metadata?: unknown) => void;
}

export interface OptimizeWithFallbackResult {
  draft: string;
  refined: string;
  spans: unknown[];
  metadata: unknown;
  usedFallback: boolean;
}

export class PromptOptimizationApi {
  optimize(options: OptimizeOptions): Promise<OptimizeResult>;
  optimizeWithFallback(options: OptimizeWithFallbackOptions): Promise<OptimizeWithFallbackResult>;
  calculateQualityScore(original: string, optimized: string): number;
}

export const promptOptimizationApiV2: PromptOptimizationApi;

