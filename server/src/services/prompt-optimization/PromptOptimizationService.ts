import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import OptimizationConfig from '@config/OptimizationConfig';

import { ContextInferenceService } from './services/ContextInferenceService';
import { ModeDetectionService } from './services/ModeDetectionService';
import { QualityAssessmentService } from './services/QualityAssessmentService';
import { StrategyFactory } from './services/StrategyFactory';
import { ShotInterpreterService } from './services/ShotInterpreterService';
import { DraftGenerationService } from './services/DraftGenerationService';
import { OptimizationCacheService } from './services/OptimizationCacheService';
import { VideoPromptCompilationService } from './services/VideoPromptCompilationService';
import { TemplateService } from './services/TemplateService';
import { I2VMotionStrategy } from './strategies/I2VMotionStrategy';
import type { ImageObservationService } from '@services/image-observation';
import type { VideoPromptService } from '../video-prompt-analysis/VideoPromptService';
import type { CapabilityValues } from '@shared/capabilities';
import type { CacheService } from '@services/cache/CacheService';
import type {
  AIService,
  OptimizationMode,
  OptimizationRequest,
  OptimizationResponse,
  TwoStageOptimizationRequest,
  TwoStageOptimizationResult,
  InferredContext,
  ShotPlan,
} from './types';
import type { I2VConstraintMode } from './types/i2v';
import type { QualityGateMetricsLike } from './workflows/types';
import { runI2vFlow } from './workflows/i2vFlow';
import { runTwoStageFlow } from './workflows/twoStageFlow';
import { runOptimizeFlow } from './workflows/optimizeFlow';
import { runIterativeRefinementFlow } from './workflows/iterativeRefinementFlow';
import { runConstitutionalReviewFlow } from './workflows/constitutionalReview';

/**
 * Refactored Prompt Optimization Service - Orchestrator Pattern
 */
export class PromptOptimizationService {
  private readonly ai: AIService;
  private readonly contextInference: ContextInferenceService;
  private readonly modeDetection: ModeDetectionService;
  private readonly qualityAssessment: QualityAssessmentService;
  private readonly strategyFactory: StrategyFactory;
  private readonly shotInterpreter: ShotInterpreterService;
  private readonly draftService: DraftGenerationService;
  private readonly optimizationCache: OptimizationCacheService;
  private readonly compilationService: VideoPromptCompilationService | null;
  private readonly videoPromptService: VideoPromptService | null;
  private readonly imageObservation: ImageObservationService;
  private readonly i2vStrategy: I2VMotionStrategy;
  private readonly templateVersions: typeof OptimizationConfig.templateVersions;
  private readonly metricsService: QualityGateMetricsLike | null;
  private readonly log: ILogger;

  constructor(
    aiService: AIService,
    cacheService: CacheService,
    videoPromptService: VideoPromptService | null = null,
    imageObservationService: ImageObservationService,
    templateService?: TemplateService,
    shotPlanCacheConfig?: { cacheTtlMs: number; cacheMax: number },
    metricsService?: QualityGateMetricsLike | null
  ) {
    this.ai = aiService;
    this.videoPromptService = videoPromptService;
    this.log = logger.child({ service: 'PromptOptimizationService' });

    const resolvedTemplateService = templateService ?? new TemplateService();
    this.contextInference = new ContextInferenceService(aiService);
    this.modeDetection = new ModeDetectionService(aiService);
    this.qualityAssessment = new QualityAssessmentService(aiService);
    this.strategyFactory = new StrategyFactory(aiService, resolvedTemplateService);
    this.shotInterpreter = new ShotInterpreterService(aiService, shotPlanCacheConfig);
    this.draftService = new DraftGenerationService(aiService);
    this.optimizationCache = new OptimizationCacheService(cacheService);
    this.compilationService = videoPromptService
      ? new VideoPromptCompilationService(videoPromptService, this.qualityAssessment)
      : null;
    this.imageObservation = imageObservationService;
    this.i2vStrategy = new I2VMotionStrategy(aiService);
    this.metricsService = metricsService ?? null;

    this.templateVersions = OptimizationConfig.templateVersions;

    this.log.info('PromptOptimizationService initialized with refactored architecture', {
      operation: 'constructor',
      availableClients: this.ai.getAvailableClients?.(),
      strategies: this.strategyFactory.getSupportedModes(),
    });
  }

  async optimizeTwoStage(
    request: TwoStageOptimizationRequest
  ): Promise<TwoStageOptimizationResult> {
    return runTwoStageFlow({
      request,
      log: this.log,
      shotInterpreter: this.shotInterpreter,
      draftService: this.draftService,
      optimize: (nextRequest) => this.optimize(nextRequest),
    });
  }

  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    const {
      prompt,
      startImage,
      generationParams = null,
      skipCache = false,
      constraintMode,
      sourcePrompt,
    } = request;

    if (startImage) {
      return this.optimizeI2V({
        prompt,
        startImage,
        generationParams,
        skipCache,
        ...(constraintMode !== undefined ? { constraintMode } : {}),
        ...(sourcePrompt !== undefined ? { sourcePrompt } : {}),
      });
    }

    return runOptimizeFlow({
      request,
      log: this.log,
      optimizationCache: this.optimizationCache,
      shotInterpreter: this.shotInterpreter,
      strategyFactory: this.strategyFactory,
      qualityAssessment: this.qualityAssessment,
      compilationService: this.compilationService,
      optimizeIteratively: (
        iterativePrompt,
        mode,
        context,
        brainstormContext,
        lockedSpans,
        iterativeGenerationParams,
        shotPlan,
        useConstitutionalAI,
        signal,
        onMetadata
      ) =>
        this.optimizeIteratively(
          iterativePrompt,
          mode,
          context,
          brainstormContext,
          lockedSpans,
          iterativeGenerationParams,
          shotPlan,
          useConstitutionalAI,
          signal,
          onMetadata
        ),
      applyConstitutionalAI: (nextPrompt, mode, signal) =>
        this.applyConstitutionalAI(nextPrompt, mode, signal),
      logOptimizationMetrics: (originalPrompt, optimizedPrompt, mode) =>
        this.logOptimizationMetrics(originalPrompt, optimizedPrompt, mode),
      metricsService: this.metricsService,
    });
  }

  private async optimizeI2V(params: {
    prompt: string;
    startImage: string;
    constraintMode?: I2VConstraintMode;
    sourcePrompt?: string;
    generationParams?: CapabilityValues | null;
    skipCache?: boolean;
  }): Promise<OptimizationResponse> {
    return runI2vFlow({
      params,
      imageObservation: this.imageObservation,
      i2vStrategy: this.i2vStrategy,
    });
  }

  /**
   * Compile a pre-optimized prompt for a specific video model (Stage 3 only)
   */
  async compilePrompt({
    prompt,
    targetModel,
    context,
  }: {
    prompt: string;
    targetModel: string;
    context?: unknown | null;
  }): Promise<{
    compiledPrompt: string;
    metadata: Record<string, unknown> | null;
    targetModel: string;
  }> {
    void context;
    if (!this.compilationService) {
      throw new Error('Video prompt service unavailable');
    }

    return this.compilationService.compilePrompt(prompt, targetModel);
  }

  /**
   * Iteratively refine a prompt until quality threshold is met
   */
  private async optimizeIteratively(
    prompt: string,
    mode: OptimizationMode,
    context: InferredContext | null,
    brainstormContext: Record<string, unknown> | null,
    lockedSpans: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }> | null,
    generationParams: CapabilityValues | null,
    shotPlan: ShotPlan | null,
    useConstitutionalAI: boolean,
    signal?: AbortSignal,
    onMetadata?: (metadata: Record<string, unknown>) => void
  ): Promise<string> {
    return runIterativeRefinementFlow({
      prompt,
      mode,
      context,
      brainstormContext,
      lockedSpans,
      generationParams,
      shotPlan,
      useConstitutionalAI,
      signal,
      onMetadata,
      log: this.log,
      strategyFactory: this.strategyFactory,
      qualityAssessment: this.qualityAssessment,
      applyConstitutionalAI: (nextPrompt, nextMode, nextSignal) =>
        this.applyConstitutionalAI(nextPrompt, nextMode, nextSignal),
    });
  }

  /**
   * Apply constitutional AI review to optimized prompt
   */
  private async applyConstitutionalAI(
    prompt: string,
    mode: OptimizationMode,
    signal?: AbortSignal
  ): Promise<string> {
    return runConstitutionalReviewFlow({
      prompt,
      mode,
      signal,
      log: this.log,
      ai: this.ai,
    });
  }

  /**
   * Automatically detect optimal mode for a prompt
   */
  async detectOptimalMode(prompt: string): Promise<OptimizationMode> {
    return this.modeDetection.detectMode(prompt);
  }

  /**
   * Infer context from a prompt
   */
  async inferContextFromPrompt(prompt: string) {
    return this.contextInference.inferContext(prompt);
  }

  /**
   * Assess the quality of a prompt
   */
  async assessPromptQuality(prompt: string, mode: OptimizationMode) {
    return this.qualityAssessment.assessQuality(prompt, mode);
  }

  /**
   * Log optimization metrics
   */
  private logOptimizationMetrics(
    originalPrompt: string,
    optimizedPrompt: string,
    mode: OptimizationMode
  ): void {
    logger.info('Optimization metrics', {
      mode,
      originalLength: originalPrompt.length,
      optimizedLength: optimizedPrompt.length,
      lengthChange: optimizedPrompt.length - originalPrompt.length,
      lengthChangePercent: ((optimizedPrompt.length / originalPrompt.length - 1) * 100).toFixed(1),
    });
  }
}

export default PromptOptimizationService;
