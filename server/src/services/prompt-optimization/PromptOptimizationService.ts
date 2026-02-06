import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { ConstitutionalAI } from '@utils/ConstitutionalAI';
import OptimizationConfig from '@config/OptimizationConfig';

// Import specialized services
import { ContextInferenceService } from './services/ContextInferenceService';
import { ModeDetectionService } from './services/ModeDetectionService';
import { QualityAssessmentService } from './services/QualityAssessmentService';
import { StrategyFactory } from './services/StrategyFactory';
import { ShotInterpreterService } from './services/ShotInterpreterService';
import { DraftGenerationService } from './services/DraftGenerationService';
import { OptimizationCacheService } from './services/OptimizationCacheService';
import { VideoPromptCompilationService } from './services/VideoPromptCompilationService';
import { templateService } from './services/TemplateService';
import { I2VMotionStrategy } from './strategies/I2VMotionStrategy';
import { ImageObservationService } from '@services/image-observation';
import { VideoPromptService } from '../video-prompt-analysis/VideoPromptService';
import type { CapabilityValues } from '@shared/capabilities';
import type {
  AIService,
  OptimizationMode,
  OptimizationRequest,
  OptimizationResponse,
  TwoStageOptimizationRequest,
  TwoStageOptimizationResult,
  ShotPlan,
  InferredContext
} from './types';
import type { I2VConstraintMode } from './types/i2v';

/**
 * Refactored Prompt Optimization Service - Orchestrator Pattern
 *
 * This service now acts as a thin orchestrator, delegating to specialized services:
 * - ContextInferenceService: Infers context from prompts
 * - ModeDetectionService: Detects optimal optimization mode
 * - QualityAssessmentService: Assesses prompt quality
 * - StrategyFactory: Creates mode-specific optimization strategies
 * - TemplateService: Manages prompt templates
 * - DraftGenerationService: Generates fast drafts for 2-stage optimization
 * - OptimizationCacheService: Manages caching
 *
 * Key improvements over the original 3,539-line God Object:
 * - Each service is small, focused, and testable (< 200 lines each)
 * - Templates are externalized to markdown files
 * - Strategy pattern enables easy addition of new modes
 * - Clear separation of concerns
 * - Configuration centralized in OptimizationConfig
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
  private readonly log: ILogger;

  constructor(
    aiService: AIService,
    videoPromptService: VideoPromptService | null = null,
    imageObservationService?: ImageObservationService
  ) {
    this.ai = aiService;
    this.videoPromptService = videoPromptService;
    this.log = logger.child({ service: 'PromptOptimizationService' });

    // Initialize specialized services
    this.contextInference = new ContextInferenceService(aiService);
    this.modeDetection = new ModeDetectionService(aiService);
    this.qualityAssessment = new QualityAssessmentService(aiService);
    this.strategyFactory = new StrategyFactory(aiService, templateService);
    this.shotInterpreter = new ShotInterpreterService(aiService);
    this.draftService = new DraftGenerationService(aiService);
    this.optimizationCache = new OptimizationCacheService();
    this.compilationService = videoPromptService
      ? new VideoPromptCompilationService(videoPromptService, this.qualityAssessment)
      : null;
    this.imageObservation = imageObservationService ?? new ImageObservationService(aiService);
    this.i2vStrategy = new I2VMotionStrategy(aiService);

    // Template versions (moved to config)
    this.templateVersions = OptimizationConfig.templateVersions;

    this.log.info('PromptOptimizationService initialized with refactored architecture', {
      operation: 'constructor',
      availableClients: this.ai.getAvailableClients?.(),
      strategies: this.strategyFactory.getSupportedModes()
    });
  }

  /**
   * Two-stage optimization: Fast draft with ChatGPT + Quality refinement with primary model
   *
   * Stage 1 (ChatGPT): Generate concise draft in ~1-3s
   * Stage 2 (Primary Model): Refine draft in background
   */
  async optimizeTwoStage({
    prompt,
    mode: _mode,
    targetModel,
    context = null,
    brainstormContext = null,
    generationParams = null,
    skipCache = false,
    lockedSpans = [],
    onDraft = null,
    onDraftChunk = null,
    onRefinedChunk = null,
    signal,
  }: TwoStageOptimizationRequest): Promise<TwoStageOptimizationResult> {
    const startTime = performance.now();
    const operation = 'optimizeTwoStage';
    const ensureNotAborted = (): void => {
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }
    };
    void _mode;
    
    const finalMode: OptimizationMode = 'video';

    this.log.debug('Starting operation.', {
      operation,
      mode: finalMode,
      promptLength: prompt.length,
      hasContext: !!context,
      hasBrainstormContext: !!brainstormContext,
      hasGenerationParams: !!generationParams,
      skipCache,
      lockedSpanCount: lockedSpans.length,
    });

    ensureNotAborted();

    // Pre-interpret the raw concept into a flexible shot plan (no hard validation on user input)
    let shotPlan: ShotPlan | null = null;
    try {
      shotPlan = await this.shotInterpreter.interpret(prompt, signal);
    } catch (interpError) {
      this.log.warn('Shot interpretation failed, proceeding without shot plan', {
        operation,
        error: (interpError as Error).message,
      });
    }

    ensureNotAborted();

    // Check if draft operation supports streaming (ChatGPT available)
    if (!this.draftService.supportsStreaming()) {
      this.log.warn('Draft streaming not available, falling back to single-stage optimization', {
        operation,
      });
      let fallbackMetadata: Record<string, unknown> | null = null;
      const result = await this.optimize({
        prompt,
        mode: finalMode,
        ...(targetModel ? { targetModel } : {}),
        context,
        brainstormContext,
        generationParams,
        skipCache,
        lockedSpans,
        onMetadata: (metadata) => {
          fallbackMetadata = { ...(fallbackMetadata || {}), ...metadata };
        },
        ...(signal ? { signal } : {}),
      });
      const fallbackPrompt = result.prompt;
      return {
        draft: fallbackPrompt,
        refined: fallbackPrompt,
        metadata: { usedFallback: true, ...(fallbackMetadata || result.metadata || {}) },
      };
    }

    try {
      // STAGE 1: Generate fast draft with ChatGPT (1-3s)
      const draftStartTime = performance.now();
      
      ensureNotAborted();

      const draft = await this.draftService.generateDraft(
        prompt,
        finalMode,
        shotPlan,
        generationParams,
        signal,
        onDraftChunk ? (delta) => onDraftChunk(delta) : undefined
      );

      const draftDuration = Math.round(performance.now() - draftStartTime);

      this.log.info('Draft generated successfully', {
        operation,
        duration: draftDuration,
        draftLength: draft.length,
        mode: finalMode,
      });

      // Call onDraft callback
      if (onDraft && typeof onDraft === 'function') {
        onDraft(draft, null);
      }

      // STAGE 2: Refine with primary model (background)
      this.log.debug('Starting refinement with primary model', {
        operation,
        mode: finalMode,
      });
      const refinementStartTime = performance.now();

      ensureNotAborted();

      let refinementMetadata: Record<string, unknown> | null = null;
      const refinedResult = await this.optimize({
        prompt: draft, // Use draft as input for refinement
        mode: finalMode,
        ...(targetModel ? { targetModel } : {}),
        context,
        brainstormContext: {
          ...(brainstormContext || {}),
          originalUserPrompt: prompt,
        },
        generationParams,
        skipCache,
        lockedSpans,
        shotPlan,
        shotPlanAttempted: true,
        onMetadata: (metadata) => {
          refinementMetadata = { ...(refinementMetadata || {}), ...metadata };
        },
        ...(onRefinedChunk ? { onChunk: (delta) => onRefinedChunk(delta) } : {}),
        ...(signal ? { signal } : {}),
      });
      const refinedPrompt = refinedResult.prompt;

      const refinementDuration = Math.round(performance.now() - refinementStartTime);
      const totalDuration = Math.round(performance.now() - startTime);

      this.log.info('Two-stage optimization complete', {
        operation,
        draftDuration,
        refinementDuration,
        totalDuration,
        mode: finalMode,
        draftLength: draft.length,
        refinedLength: refinedPrompt.length,
      });

      return {
        draft,
        refined: refinedPrompt,
        draftSpans: null,
        refinedSpans: null, // Skip for performance
        metadata: {
          draftDuration,
          refinementDuration,
          totalDuration,
          mode: finalMode,
          usedTwoStage: true,
          shotPlan,
          ...(refinementMetadata || {}),
        }
      };

    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        this.log.info('Two-stage optimization aborted', {
          operation,
          duration: Math.round(performance.now() - startTime),
          mode: finalMode,
        });
        throw error;
      }
      this.log.error('Two-stage optimization failed, falling back to single-stage', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
      });

      let fallbackMetadata: Record<string, unknown> | null = null;
      const result = await this.optimize({
        prompt,
        mode: finalMode,
        ...(targetModel ? { targetModel } : {}),
        context,
        brainstormContext,
        generationParams,
        skipCache,
        lockedSpans,
        shotPlan,
        shotPlanAttempted: true,
        onMetadata: (metadata) => {
          fallbackMetadata = { ...(fallbackMetadata || {}), ...metadata };
        },
        ...(signal ? { signal } : {}),
      });
      const fallbackPrompt = result.prompt;
      return {
        draft: fallbackPrompt,
        refined: fallbackPrompt,
        metadata: {
          mode: finalMode,
          usedFallback: true,
          shotPlan,
          ...(fallbackMetadata || {}),
        },
        usedFallback: true,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Main optimization method - delegates to appropriate strategy
   */
  async optimize({
    prompt,
    mode: _mode,
    context = null,
    brainstormContext = null,
    generationParams = null,
    skipCache = false,
    lockedSpans = [],
    shotPlan = null,
    shotPlanAttempted = false,
    useConstitutionalAI = false,
    useIterativeRefinement = false,
    onMetadata,
    onChunk,
    signal,
    targetModel, // Extract targetModel
    startImage,
    constraintMode,
    sourcePrompt,
  }: OptimizationRequest): Promise<OptimizationResponse> {
    const startTime = performance.now();
    const operation = 'optimize';
    const ensureNotAborted = (): void => {
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }
    };
    void _mode;

    if (startImage) {
      return this.optimizeI2V({
        prompt,
        startImage,
        constraintMode,
        sourcePrompt,
        generationParams,
        skipCache,
      });
    }

    const finalMode: OptimizationMode = 'video';

    this.log.debug('Starting operation.', {
      operation,
      mode: finalMode,
      promptLength: prompt.length,
      hasContext: !!context,
      hasBrainstormContext: !!brainstormContext,
      hasGenerationParams: !!generationParams,
      hasShotPlan: !!shotPlan,
      shotPlanAttempted,
      useConstitutionalAI,
      useIterativeRefinement,
      skipCache,
      lockedSpanCount: lockedSpans.length,
    });

    ensureNotAborted();

    // Check cache
    const cacheKey = this.optimizationCache.buildCacheKey(
      prompt,
      finalMode,
      context,
      brainstormContext,
      targetModel,
      generationParams,
      lockedSpans
    );

    if (!skipCache) {
      const cached = await this.optimizationCache.getCachedResult(cacheKey);
      if (cached) {
        const cachedMetadata = await this.optimizationCache.getCachedMetadata(cacheKey);
        if (onMetadata && cachedMetadata) {
          onMetadata(cachedMetadata);
        }
        this.log.debug('Returning cached optimization result', {
          operation,
          mode: finalMode,
          duration: Math.round(performance.now() - startTime),
        });
        return {
          prompt: cached,
          inputMode: 't2v',
          ...(cachedMetadata ? { metadata: cachedMetadata } : {}),
        };
      }
    } else {
      this.log.debug('Skipping optimization cache', {
        operation,
        mode: finalMode,
      });
    }

    // Interpret shot plan if not already provided
    let interpretedShotPlan: ShotPlan | null = shotPlan;
    if (!interpretedShotPlan && !shotPlanAttempted) {
      try {
        ensureNotAborted();
        interpretedShotPlan = await this.shotInterpreter.interpret(prompt, signal);
      } catch (interpError) {
        this.log.warn('Shot interpretation (single-stage) failed, proceeding without plan', {
          operation,
          error: (interpError as Error).message,
        });
      }
    }

    try {
      let optimizedPrompt: string;
      let optimizationMetadata: Record<string, unknown> | null = null;
      const handleMetadata = (metadata: Record<string, unknown>): void => {
        optimizationMetadata = { ...(optimizationMetadata || {}), ...metadata };
        if (onMetadata) {
          onMetadata(metadata);
        }
      };

      // Use iterative refinement if requested
      if (useIterativeRefinement) {
        optimizedPrompt = await this.optimizeIteratively(
          prompt,
          finalMode,
          context,
          brainstormContext,
          lockedSpans,
          generationParams,
          interpretedShotPlan,
          useConstitutionalAI,
          signal,
          handleMetadata
        );
      } else {
        // Get appropriate strategy and optimize
        const strategy = this.strategyFactory.getStrategy(finalMode);

        // Generate domain content if strategy supports it
        const domainContent = strategy.generateDomainContent
          ? await strategy.generateDomainContent(prompt, context || null, interpretedShotPlan)
          : null;

        // Optimize using strategy
        optimizedPrompt = await strategy.optimize({
          prompt,
          context,
          brainstormContext,
          generationParams,
          domainContent: domainContent as string | null,
          shotPlan: interpretedShotPlan,
          lockedSpans,
          onMetadata: handleMetadata,
          ...(onChunk ? { onChunk } : {}),
          ...(signal ? { signal } : {}),
        });

        // Apply constitutional AI review if requested
        if (useConstitutionalAI) {
          optimizedPrompt = await this.applyConstitutionalAI(optimizedPrompt, finalMode, signal);
        }
      }

      let qualityAssessment = await this.qualityAssessment.assessQuality(optimizedPrompt, finalMode);
      const qualityThreshold = OptimizationConfig.quality.minAcceptableScore;

      handleMetadata({
        qualityAssessment,
      });

      if (!useIterativeRefinement && qualityAssessment.score < qualityThreshold) {
        const initialScore = qualityAssessment.score;
        this.log.warn('Quality gate failed, attempting bounded refinement', {
          operation,
          score: initialScore,
          threshold: qualityThreshold,
        });

        optimizedPrompt = await this.optimizeIteratively(
          prompt,
          finalMode,
          context,
          brainstormContext,
          lockedSpans,
          generationParams,
          interpretedShotPlan,
          useConstitutionalAI,
          signal,
          handleMetadata
        );

        qualityAssessment = await this.qualityAssessment.assessQuality(optimizedPrompt, finalMode);
        handleMetadata({
          qualityAssessment,
          qualityGate: {
            triggered: true,
            initialScore,
            finalScore: qualityAssessment.score,
          },
        });
      }

      // Record generic prompt before model compilation
      handleMetadata({ genericPrompt: optimizedPrompt });

      // STAGE 3: Model-Specific Compilation (The "Compiler" Phase)
      if (finalMode === 'video' && this.compilationService) {
        const compilation = await this.compilationService.compileOptimizedPrompt({
          operation,
          optimizedPrompt,
          targetModel,
          mode: finalMode,
          qualityAssessment,
        });

        optimizedPrompt = compilation.prompt;
        if (compilation.metadata) {
          handleMetadata(compilation.metadata);
        }
      }

      // Cache the result
      await this.optimizationCache.cacheResult(cacheKey, optimizedPrompt, optimizationMetadata);

      // Log metrics
      this.logOptimizationMetrics(prompt, optimizedPrompt, finalMode);

      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
        inputLength: prompt.length,
        outputLength: optimizedPrompt.length,
        useConstitutionalAI,
        useIterativeRefinement,
      });

      return {
        prompt: optimizedPrompt,
        inputMode: 't2v',
        ...(optimizationMetadata ? { metadata: optimizationMetadata } : {}),
      };

    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        this.log.info('Operation aborted.', {
          operation,
          duration: Math.round(performance.now() - startTime),
          mode: finalMode,
        });
        throw error;
      }
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
        promptLength: prompt.length,
      });
      throw error;
    }
  }

  /**
   * I2V optimization (motion-focused)
   */
  private async optimizeI2V(params: {
    prompt: string;
    startImage: string;
    constraintMode?: I2VConstraintMode;
    sourcePrompt?: string;
    generationParams?: CapabilityValues | null;
    skipCache?: boolean;
  }): Promise<OptimizationResponse> {
    const { prompt, startImage, constraintMode, sourcePrompt, generationParams, skipCache } = params;
    const observationResult = await this.imageObservation.observe({
      image: startImage,
      skipCache: skipCache === true,
      ...(sourcePrompt ? { sourcePrompt } : {}),
    });

    const observation = observationResult.observation;
    if (!observation) {
      throw new Error('Image observation failed');
    }

    const cameraMotionLocked = this.isCameraMotionLocked(generationParams);
    const mode: I2VConstraintMode = constraintMode || 'strict';
    const result = await this.i2vStrategy.optimize({
      prompt,
      observation,
      mode,
      cameraMotionLocked,
    });

    return {
      prompt: result.prompt,
      inputMode: 'i2v',
      i2v: result,
      metadata: {
        observationCached: observationResult.cached,
        observationUsedFastPath: observationResult.usedFastPath,
      },
    };
  }

  private isCameraMotionLocked(generationParams?: CapabilityValues | null): boolean {
    if (!generationParams) {
      return false;
    }
    const params = generationParams as Record<string, unknown>;
    const cameraMotionId = typeof params.camera_motion_id === 'string'
      ? params.camera_motion_id
      : typeof params.cameraMotionId === 'string'
        ? params.cameraMotionId
        : '';
    return cameraMotionId.trim().length > 0;
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
    const startTime = performance.now();
    const operation = 'optimizeIteratively';
    const ensureNotAborted = (): void => {
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }
    };
    
    this.log.debug('Starting operation.', {
      operation,
      mode,
      promptLength: prompt.length,
    });

    const maxIterations = OptimizationConfig.iterativeRefinement.maxIterations;
    const targetScore = OptimizationConfig.quality.targetScore;
    const improvementThreshold = OptimizationConfig.iterativeRefinement.improvementThreshold;

    let currentPrompt = prompt;
    let bestPrompt = prompt;
    let bestScore = 0;
    let lastMetadata: Record<string, unknown> | null = null;
    const collectMetadata = (metadata: Record<string, unknown>): void => {
      lastMetadata = metadata;
    };

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      ensureNotAborted();
      this.log.debug('Iteration starting', {
        operation,
        iteration,
        currentScore: bestScore,
      });

      // Optimize
      const strategy = this.strategyFactory.getStrategy(mode);
      const domainContent = strategy.generateDomainContent
        ? await strategy.generateDomainContent(currentPrompt, context, shotPlan)
        : null;
      const optimized = await strategy.optimize({
        prompt: currentPrompt,
        context,
        brainstormContext,
        generationParams,
        domainContent: domainContent as string | null,
        shotPlan,
        ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
        onMetadata: collectMetadata,
        ...(signal ? { signal } : {}),
      });

      // Apply constitutional AI if requested
      const finalOptimized = useConstitutionalAI
        ? await this.applyConstitutionalAI(optimized, mode, signal)
        : optimized;

      // Assess quality
      const assessment = await this.qualityAssessment.assessQuality(finalOptimized, mode);

      // Update best if improved
      if (assessment.score > bestScore) {
        bestScore = assessment.score;
        bestPrompt = finalOptimized;
        this.log.debug('Iteration improved quality', {
          operation,
          iteration,
          score: bestScore,
        });
      }

      // Stop if target reached
      if (assessment.score >= targetScore) {
        this.log.info('Target quality reached', {
          operation,
          iteration,
          score: bestScore,
          duration: Math.round(performance.now() - startTime),
        });
        break;
      }

      // Stop if improvement is marginal
      if (iteration > 0 && (assessment.score - bestScore) < improvementThreshold) {
        this.log.debug('Marginal improvement, stopping', {
          operation,
          iteration,
        });
        break;
      }

      currentPrompt = finalOptimized;
    }

    this.log.info('Operation completed.', {
      operation,
      finalScore: bestScore,
      iterations: maxIterations,
      duration: Math.round(performance.now() - startTime),
    });

    if (onMetadata && lastMetadata) {
      onMetadata(lastMetadata);
    }

    return bestPrompt;
  }

  /**
   * Apply constitutional AI review to optimized prompt
   */
  private async applyConstitutionalAI(
    prompt: string,
    mode: OptimizationMode,
    signal?: AbortSignal
  ): Promise<string> {
    const startTime = performance.now();
    const operation = 'applyConstitutionalAI';
    
    this.log.debug('Starting operation.', {
      operation,
      mode,
      promptLength: prompt.length,
    });

    try {
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const sampleRate = OptimizationConfig.constitutionalAI?.sampleRate ?? 1;
      if (sampleRate < 1 && Math.random() > Math.max(0, Math.min(1, sampleRate))) {
        this.log.debug('Operation skipped (sampled out).', {
          operation,
          sampleRate,
        });
        return prompt;
      }

      const claudeClient = {
        complete: async (reviewPrompt: string, options?: { maxTokens?: number }) => {
          const response = await this.ai.execute('optimize_quality_assessment', {
            systemPrompt: reviewPrompt,
            maxTokens: options?.maxTokens ?? 2048,
            temperature: 0.2,
            ...(signal ? { signal } : {}),
          });
          const content = response.content?.map((item) => ({ text: item.text ?? '' }));
          return {
            text: response.text,
            ...(content ? { content } : {}),
          };
        },
      };

      const reviewResult = await ConstitutionalAI.applyConstitutionalReview(
        claudeClient,
        prompt,
        prompt
      );

      if (reviewResult.revised) {
        this.log.info('Constitutional AI suggested revisions', {
          operation,
          issueCount: reviewResult.critique?.issues?.length || 0,
          duration: Math.round(performance.now() - startTime),
        });
        return reviewResult.output;
      }

      this.log.debug('Operation completed; no revisions needed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
      });

      return prompt;
    } catch (error) {
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return prompt; // Return original on failure
    }
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
  private logOptimizationMetrics(originalPrompt: string, optimizedPrompt: string, mode: OptimizationMode): void {
    logger.info('Optimization metrics', {
      mode,
      originalLength: originalPrompt.length,
      optimizedLength: optimizedPrompt.length,
      lengthChange: optimizedPrompt.length - originalPrompt.length,
      lengthChangePercent: ((optimizedPrompt.length / originalPrompt.length - 1) * 100).toFixed(1)
    });
  }
}

export default PromptOptimizationService;
