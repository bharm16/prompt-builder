import type { ILogger } from '@interfaces/ILogger';
import type { CapabilityValues } from '@shared/capabilities';
import type {
  AIService,
  CompilationState,
  CompileContext,
  CompileSource,
  InferredContext,
  OptimizationMode,
  OptimizationRequest,
  OptimizationResponse,
  ShotPlan,
  StructuredOptimizationArtifact,
} from '../types';
import type { I2VConstraintMode, I2VOptimizationResult } from '../types/i2v';

export type MetadataMap = Record<string, unknown>;

export type OptimizationCacheLike = {
  buildCacheKey(
    prompt: string,
    mode: OptimizationMode,
    context: InferredContext | null,
    brainstormContext: Record<string, unknown> | null,
    targetModel?: string,
    generationParams?: Record<string, unknown> | null,
    lockedSpans?: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>
  ): string;
  buildStructuredArtifactKeyFromInputs(params: {
    prompt: string;
    sourcePrompt?: string | null;
    shotPlan?: ShotPlan | null;
    generationParams?: Record<string, unknown> | null;
    lockedSpans?: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>;
  }): string;
  getCachedResult(key: string): Promise<string | null>;
  getCachedMetadata(key: string): Promise<MetadataMap | null>;
  getStructuredArtifact(key: string): Promise<StructuredOptimizationArtifact | null>;
  cacheResult(key: string, result: string, metadata?: MetadataMap | null): Promise<void>;
  cacheStructuredArtifact(
    key: string,
    artifact: StructuredOptimizationArtifact
  ): Promise<void>;
};

export type ShotInterpreterLike = {
  interpret(prompt: string, signal?: AbortSignal): Promise<ShotPlan | null>;
};

export type OptimizationStrategyLike = {
  optimize(request: OptimizationRequest): Promise<string>;
  optimizeStructured?(request: OptimizationRequest): Promise<StructuredOptimizationArtifact>;
  renderStructuredPrompt?(structuredPrompt: StructuredOptimizationArtifact['structuredPrompt']): string;
  generateDomainContent?(
    prompt: string,
    context?: InferredContext | null,
    shotPlan?: ShotPlan | null
  ): Promise<unknown>;
};

export type CompilationServiceLike = {
  compile(args: {
    operation: string;
    mode: OptimizationMode;
    targetModel?: string;
    source: CompileSource;
    context?: CompileContext | null;
    fallbackPrompt?: string;
    artifactKey?: string;
  }): Promise<{
    prompt: string;
    metadata: MetadataMap | null;
    compilation: CompilationState;
    artifactKey?: string;
  }>;
};

export type ConstitutionalReviewLike = (
  prompt: string,
  mode: OptimizationMode,
  signal?: AbortSignal | undefined
) => Promise<string>;

export type IntentLockLike = {
  enforceIntentLock(params: {
    originalPrompt: string;
    optimizedPrompt: string;
    shotPlan: ShotPlan | null;
  }): {
    prompt: string;
    passed: boolean;
    repaired: boolean;
    required: { subject: string | null; action: string | null };
  };
  validateIntentPreservation?(params: {
    originalPrompt: string;
    optimizedPrompt: string;
    shotPlan: ShotPlan | null;
  }): {
    passed: boolean;
    required: { subject: string | null; action: string | null };
  };
};

export type PromptLintLike = {
  enforce(params: {
    prompt: string;
    modelId?: string | null;
  }): {
    prompt: string;
    lint: { ok: boolean; errors: string[]; warnings: string[]; wordCount: number };
    repaired: boolean;
  };
};

export interface OptimizeFlowArgs {
  request: OptimizationRequest;
  log: ILogger;
  optimizationCache: OptimizationCacheLike;
  shotInterpreter: ShotInterpreterLike;
  strategy: OptimizationStrategyLike;
  compilationService: CompilationServiceLike | null;
  applyConstitutionalAI: ConstitutionalReviewLike;
  logOptimizationMetrics: (
    originalPrompt: string,
    optimizedPrompt: string,
    mode: OptimizationMode
  ) => void;
  intentLock: IntentLockLike;
  promptLint: PromptLintLike;
}

export type ImageObservationLike = {
  observe(params: {
    image: string;
    skipCache: boolean;
    sourcePrompt?: string;
  }): Promise<{
    observation?: unknown;
    cached: boolean;
    usedFastPath: boolean;
  }>;
};

export type I2VStrategyLike = {
  optimize(params: unknown): Promise<I2VOptimizationResult>;
};

export interface I2VFlowArgs {
  params: {
    prompt: string;
    startImage: string;
    constraintMode?: I2VConstraintMode;
    sourcePrompt?: string;
    generationParams?: CapabilityValues | null;
    skipCache?: boolean;
  };
  imageObservation: ImageObservationLike;
  i2vStrategy: I2VStrategyLike;
}

export interface ConstitutionalReviewFlowArgs {
  prompt: string;
  mode: OptimizationMode;
  signal?: AbortSignal | undefined;
  log: ILogger;
  ai: AIService;
}
