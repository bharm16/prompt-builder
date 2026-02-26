import type { ILogger } from '@interfaces/ILogger';
import type { CapabilityValues } from '@shared/capabilities';
import type {
  AIService,
  InferredContext,
  LockedSpan,
  OptimizationMode,
  OptimizationRequest,
  OptimizationResponse,
  QualityAssessment,
  ShotPlan,
  TwoStageOptimizationRequest,
  TwoStageOptimizationResult,
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
  getCachedResult(key: string): Promise<string | null>;
  getCachedMetadata(key: string): Promise<MetadataMap | null>;
  cacheResult(key: string, result: string, metadata?: MetadataMap | null): Promise<void>;
};

export type ShotInterpreterLike = {
  interpret(prompt: string, signal?: AbortSignal): Promise<ShotPlan | null>;
};

export type OptimizationStrategyLike = {
  optimize(request: OptimizationRequest): Promise<string>;
  generateDomainContent?(
    prompt: string,
    context?: InferredContext | null,
    shotPlan?: ShotPlan | null
  ): Promise<unknown>;
};

export type StrategyFactoryLike = {
  getStrategy(mode: OptimizationMode): OptimizationStrategyLike;
};

export type QualityAssessmentLike = {
  assessQuality(prompt: string, mode: OptimizationMode): Promise<QualityAssessment>;
};

export type CompilationServiceLike = {
  compileOptimizedPrompt(args: {
    operation: string;
    optimizedPrompt: string;
    mode: OptimizationMode;
    qualityAssessment: QualityAssessment;
    targetModel?: string;
  }): Promise<{ prompt: string; metadata: MetadataMap | null }>;
};

export type IterativeRefinementLike = (
  prompt: string,
  mode: OptimizationMode,
  context: InferredContext | null,
  brainstormContext: Record<string, unknown> | null,
  lockedSpans: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }> | null,
  generationParams: CapabilityValues | null,
  shotPlan: ShotPlan | null,
  useConstitutionalAI: boolean,
  signal?: AbortSignal | undefined,
  onMetadata?: ((metadata: MetadataMap) => void) | undefined
) => Promise<string>;

export type ConstitutionalReviewLike = (
  prompt: string,
  mode: OptimizationMode,
  signal?: AbortSignal | undefined
) => Promise<string>;

export interface OptimizeFlowArgs {
  request: OptimizationRequest;
  log: ILogger;
  optimizationCache: OptimizationCacheLike;
  shotInterpreter: ShotInterpreterLike;
  strategyFactory: StrategyFactoryLike;
  qualityAssessment: QualityAssessmentLike;
  compilationService: CompilationServiceLike | null;
  optimizeIteratively: IterativeRefinementLike;
  applyConstitutionalAI: ConstitutionalReviewLike;
  logOptimizationMetrics: (
    originalPrompt: string,
    optimizedPrompt: string,
    mode: OptimizationMode
  ) => void;
}

export type DraftGenerationLike = {
  supportsStreaming(): boolean;
  generateDraft(
    prompt: string,
    mode: OptimizationMode,
    shotPlan: ShotPlan | null,
    generationParams: CapabilityValues | null,
    signal?: AbortSignal,
    onChunk?: (delta: string) => void
  ): Promise<string>;
};

export interface TwoStageFlowArgs {
  request: TwoStageOptimizationRequest;
  log: ILogger;
  shotInterpreter: ShotInterpreterLike;
  draftService: DraftGenerationLike;
  optimize: (request: OptimizationRequest) => Promise<OptimizationResponse>;
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

export interface IterativeRefinementFlowArgs {
  prompt: string;
  mode: OptimizationMode;
  context: InferredContext | null;
  brainstormContext: Record<string, unknown> | null;
  lockedSpans: LockedSpan[] | null;
  generationParams: CapabilityValues | null;
  shotPlan: ShotPlan | null;
  useConstitutionalAI: boolean;
  signal?: AbortSignal | undefined;
  onMetadata?: ((metadata: MetadataMap) => void) | undefined;
  log: ILogger;
  strategyFactory: StrategyFactoryLike;
  qualityAssessment: QualityAssessmentLike;
  applyConstitutionalAI: ConstitutionalReviewLike;
}

export interface ConstitutionalReviewFlowArgs {
  prompt: string;
  mode: OptimizationMode;
  signal?: AbortSignal | undefined;
  log: ILogger;
  ai: AIService;
}

export type TwoStageResult = Promise<TwoStageOptimizationResult>;
