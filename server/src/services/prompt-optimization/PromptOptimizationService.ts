import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import OptimizationConfig from '@config/OptimizationConfig';

import { ContextInferenceService } from './services/ContextInferenceService';
import { ModeDetectionService } from './services/ModeDetectionService';
import { StrategyFactory } from './services/StrategyFactory';
import { ShotInterpreterService } from './services/ShotInterpreterService';
import { DraftGenerationService } from './services/DraftGenerationService';
import { OptimizationCacheService } from './services/OptimizationCacheService';
import { VideoPromptCompilationService } from './services/VideoPromptCompilationService';
import { TemplateService } from './services/TemplateService';
import { IntentLockService } from './services/IntentLockService';
import { PromptLintGateService } from './services/PromptLintGateService';
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
} from './types';
import type { I2VConstraintMode } from './types/i2v';
import { runI2vFlow } from './workflows/i2vFlow';
import { runTwoStageFlow } from './workflows/twoStageFlow';
import { runOptimizeFlow } from './workflows/optimizeFlow';
import { runConstitutionalReviewFlow } from './workflows/constitutionalReview';

/**
 * Refactored Prompt Optimization Service - Orchestrator Pattern
 */
export class PromptOptimizationService {
  private readonly ai: AIService;
  private readonly contextInference: ContextInferenceService;
  private readonly modeDetection: ModeDetectionService;
  private readonly strategyFactory: StrategyFactory;
  private readonly shotInterpreter: ShotInterpreterService;
  private readonly draftService: DraftGenerationService;
  private readonly optimizationCache: OptimizationCacheService;
  private readonly compilationService: VideoPromptCompilationService | null;
  private readonly imageObservation: ImageObservationService;
  private readonly i2vStrategy: I2VMotionStrategy;
  private readonly templateVersions: typeof OptimizationConfig.templateVersions;
  private readonly intentLock: IntentLockService;
  private readonly promptLint: PromptLintGateService;
  private readonly pipelineV2Enabled: boolean;
  private readonly log: ILogger;

  constructor(
    aiService: AIService,
    cacheService: CacheService,
    videoPromptService: VideoPromptService | null = null,
    imageObservationService: ImageObservationService,
    templateService?: TemplateService,
    shotPlanCacheConfig?: { cacheTtlMs: number; cacheMax: number }
  ) {
    this.ai = aiService;
    this.log = logger.child({ service: 'PromptOptimizationService' });

    const resolvedTemplateService = templateService ?? new TemplateService();
    this.contextInference = new ContextInferenceService(aiService);
    this.modeDetection = new ModeDetectionService(aiService);
    this.strategyFactory = new StrategyFactory(aiService, resolvedTemplateService);
    this.shotInterpreter = new ShotInterpreterService(aiService, shotPlanCacheConfig);
    this.draftService = new DraftGenerationService(aiService);
    this.optimizationCache = new OptimizationCacheService(cacheService);
    this.compilationService = videoPromptService
      ? new VideoPromptCompilationService(videoPromptService)
      : null;
    this.imageObservation = imageObservationService;
    this.i2vStrategy = new I2VMotionStrategy(aiService);
    this.intentLock = new IntentLockService();
    this.promptLint = new PromptLintGateService();
    this.pipelineV2Enabled = process.env.PROMPT_PIPELINE_V2 !== 'false';

    this.templateVersions = OptimizationConfig.templateVersions;

    this.log.info('PromptOptimizationService initialized with refactored architecture', {
      operation: 'constructor',
      availableClients: this.ai.getAvailableClients?.(),
      strategies: this.strategyFactory.getSupportedModes(),
      pipelineV2Enabled: this.pipelineV2Enabled,
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
      compilationService: this.compilationService,
      applyConstitutionalAI: (nextPrompt, mode, signal) =>
        this.applyConstitutionalAI(nextPrompt, mode, signal),
      logOptimizationMetrics: (originalPrompt, optimizedPrompt, mode) =>
        this.logOptimizationMetrics(originalPrompt, optimizedPrompt, mode),
      intentLock: this.pipelineV2Enabled
        ? this.intentLock
        : {
            enforceIntentLock: ({ optimizedPrompt, originalPrompt, shotPlan }) => {
              void originalPrompt;
              void shotPlan;
              return {
                prompt: optimizedPrompt,
                passed: true,
                repaired: false,
                required: { subject: null, action: null },
              };
            },
          },
      promptLint: this.pipelineV2Enabled
        ? this.promptLint
        : {
            enforce: ({ prompt }) => ({
              prompt,
              lint: { ok: true, errors: [], warnings: [], wordCount: prompt.split(/\s+/).length },
              repaired: false,
            }),
          },
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
    if (!this.compilationService) {
      throw new Error('Video prompt service unavailable');
    }

    const compilation = await this.compilationService.compilePrompt(prompt, targetModel);
    let compiledPrompt = compilation.compiledPrompt;
    let metadata = compilation.metadata;

    if (this.pipelineV2Enabled) {
      const originalPrompt = this.resolveOriginalPromptForCompile(context, prompt);
      const intent = this.intentLock.enforceIntentLock({
        originalPrompt,
        optimizedPrompt: compiledPrompt,
        shotPlan: null,
      });
      compiledPrompt = intent.prompt;

      const lint = this.promptLint.enforce({
        prompt: compiledPrompt,
        modelId: compilation.targetModel,
      });
      compiledPrompt = lint.prompt;

      metadata = {
        ...(metadata || {}),
        intentLockPassed: intent.passed,
        intentLockRepaired: intent.repaired,
        requiredIntent: intent.required,
        promptLint: lint.lint,
        promptLintRepaired: lint.repaired,
      };
    }

    return {
      ...compilation,
      compiledPrompt,
      metadata,
    };
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

  private resolveOriginalPromptForCompile(context: unknown | null | undefined, fallbackPrompt: string): string {
    if (!context || typeof context !== 'object') {
      return fallbackPrompt;
    }

    const contextRecord = context as Record<string, unknown>;
    const originalPromptCandidate = contextRecord.originalPrompt;
    if (typeof originalPromptCandidate === 'string' && originalPromptCandidate.trim().length > 0) {
      return originalPromptCandidate.trim();
    }

    const originalUserPromptCandidate = contextRecord.originalUserPrompt;
    if (
      typeof originalUserPromptCandidate === 'string' &&
      originalUserPromptCandidate.trim().length > 0
    ) {
      return originalUserPromptCandidate.trim();
    }

    return fallbackPrompt;
  }
}

export default PromptOptimizationService;
