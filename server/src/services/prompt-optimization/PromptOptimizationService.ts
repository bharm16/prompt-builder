import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { cacheService } from '@services/cache/CacheService';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { ConstitutionalAI } from '@utils/ConstitutionalAI';
import OptimizationConfig from '@config/OptimizationConfig';

// Import specialized services
import { ContextInferenceService } from './services/ContextInferenceService';
import { ModeDetectionService } from './services/ModeDetectionService';
import { QualityAssessmentService } from './services/QualityAssessmentService';
import { StrategyFactory } from './services/StrategyFactory';
import { ShotInterpreterService } from './services/ShotInterpreterService';
import { templateService } from './services/TemplateService';
import type {
  AIService,
  OptimizationMode,
  OptimizationRequest,
  TwoStageOptimizationRequest,
  TwoStageOptimizationResult,
  ShotPlan,
  InferredContext
} from './types';

/**
 * Refactored Prompt Optimization Service - Orchestrator Pattern
 *
 * This service now acts as a thin orchestrator, delegating to specialized services:
 * - ContextInferenceService: Infers context from prompts
 * - ModeDetectionService: Detects optimal optimization mode
 * - QualityAssessmentService: Assesses prompt quality
 * - StrategyFactory: Creates mode-specific optimization strategies
 * - TemplateService: Manages prompt templates
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
  private readonly cacheConfig: { ttl: number; namespace: string };
  private readonly templateVersions: typeof OptimizationConfig.templateVersions;
  private readonly log: ILogger;

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.log = logger.child({ service: 'PromptOptimizationService' });

    // Initialize specialized services
    this.contextInference = new ContextInferenceService(aiService);
    this.modeDetection = new ModeDetectionService(aiService);
    this.qualityAssessment = new QualityAssessmentService(aiService);
    this.strategyFactory = new StrategyFactory(aiService, templateService);
    this.shotInterpreter = new ShotInterpreterService(aiService);

    // Cache configuration
    this.cacheConfig = cacheService.getConfig(OptimizationConfig.cache.promptOptimization);

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
    mode,
    context = null,
    brainstormContext = null,
    onDraft = null,
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
    
    // Default to video mode (only mode supported)
    let finalMode: OptimizationMode = mode || 'video';
    if (finalMode !== 'video') {
      this.log.warn('Non-video mode specified, defaulting to video', {
        operation,
        requestedMode: mode,
      });
      finalMode = 'video';
    }

    this.log.debug(`Starting ${operation}`, {
      operation,
      mode: finalMode,
      promptLength: prompt.length,
      hasContext: !!context,
      hasBrainstormContext: !!brainstormContext,
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
    if (!this.ai.supportsStreaming?.('optimize_draft')) {
      this.log.warn('Draft streaming not available, falling back to single-stage optimization', {
        operation,
      });
      let fallbackMetadata: Record<string, unknown> | null = null;
      const result = await this.optimize({
        prompt,
        mode: finalMode,
        context,
        brainstormContext,
        onMetadata: (metadata) => {
          fallbackMetadata = { ...(fallbackMetadata || {}), ...metadata };
        },
        ...(signal ? { signal } : {}),
      });
      return {
        draft: result,
        refined: result,
        metadata: { usedFallback: true, ...(fallbackMetadata || {}) },
      };
    }

    try {
      // STAGE 1: Generate fast draft with ChatGPT (1-3s)
      const draftSystemPrompt = this.getDraftSystemPrompt(finalMode, shotPlan);
      this.log.debug('Generating draft with ChatGPT', {
        operation,
        mode: finalMode,
        hasShotPlan: !!shotPlan,
      });
      const draftStartTime = performance.now();

      ensureNotAborted();

      const draftResponse = await this.ai.execute('optimize_draft', {
        systemPrompt: draftSystemPrompt,
        userMessage: prompt,
        maxTokens: OptimizationConfig.tokens.draft[finalMode] || OptimizationConfig.tokens.draft.default,
        temperature: OptimizationConfig.temperatures.draft,
        timeout: OptimizationConfig.timeouts.draft,
        ...(signal ? { signal } : {}),
      });

      const draft = draftResponse.text || draftResponse.content?.[0]?.text || '';
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
      const refined = await this.optimize({
        prompt: draft, // Use draft as input for refinement
        mode: finalMode,
        context,
        brainstormContext: {
          ...(brainstormContext || {}),
          originalUserPrompt: prompt,
        },
        shotPlan,
        shotPlanAttempted: true,
        onMetadata: (metadata) => {
          refinementMetadata = { ...(refinementMetadata || {}), ...metadata };
        },
        ...(signal ? { signal } : {}),
      });

      const refinementDuration = Math.round(performance.now() - refinementStartTime);
      const totalDuration = Math.round(performance.now() - startTime);

      this.log.info('Two-stage optimization complete', {
        operation,
        draftDuration,
        refinementDuration,
        totalDuration,
        mode: finalMode,
        draftLength: draft.length,
        refinedLength: refined.length,
      });

      return {
        draft,
        refined,
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
        context,
        brainstormContext,
        shotPlan,
        shotPlanAttempted: true,
        onMetadata: (metadata) => {
          fallbackMetadata = { ...(fallbackMetadata || {}), ...metadata };
        },
        ...(signal ? { signal } : {}),
      });
      return {
        draft: result,
        refined: result,
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
    mode,
    context = null,
    brainstormContext = null,
    shotPlan = null,
    shotPlanAttempted = false,
    useConstitutionalAI = false,
    useIterativeRefinement = false,
    onMetadata,
    signal,
  }: OptimizationRequest): Promise<string> {
    const startTime = performance.now();
    const operation = 'optimize';
    const ensureNotAborted = (): void => {
      if (signal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }
    };
    
    // Default to video mode (only mode supported)
    let finalMode: OptimizationMode = mode || 'video';
    if (!finalMode) {
      finalMode = 'video';
      this.log.debug('Mode not specified, defaulting to video', {
        operation,
      });
    } else if (finalMode !== 'video') {
      this.log.warn('Non-video mode specified, defaulting to video', {
        operation,
        requestedMode: mode,
      });
      finalMode = 'video';
    }

    this.log.debug(`Starting ${operation}`, {
      operation,
      mode: finalMode,
      promptLength: prompt.length,
      hasContext: !!context,
      hasBrainstormContext: !!brainstormContext,
      hasShotPlan: !!shotPlan,
      shotPlanAttempted,
      useConstitutionalAI,
      useIterativeRefinement,
    });

    ensureNotAborted();

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

    // Check cache
    const cacheKey = this.buildCacheKey(prompt, finalMode, context, brainstormContext);
    const cacheMetadataKey = this.buildMetadataCacheKey(cacheKey);
    const cached = await cacheService.get<string>(cacheKey);
    if (cached) {
      if (onMetadata) {
        const cachedMetadata = await cacheService.get<Record<string, unknown>>(cacheMetadataKey);
        if (cachedMetadata) {
          onMetadata(cachedMetadata);
        }
      }
      this.log.debug('Returning cached optimization result', {
        operation,
        mode: finalMode,
        duration: Math.round(performance.now() - startTime),
      });
      return cached;
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
          domainContent,
          shotPlan: interpretedShotPlan,
          onMetadata: handleMetadata,
          ...(signal ? { signal } : {}),
        });

        // Apply constitutional AI review if requested
        if (useConstitutionalAI) {
          optimizedPrompt = await this.applyConstitutionalAI(optimizedPrompt, finalMode, signal);
        }
      }

      // Cache the result
      await cacheService.set(cacheKey, optimizedPrompt, this.cacheConfig);
      if (optimizationMetadata) {
        await cacheService.set(cacheMetadataKey, optimizationMetadata, this.cacheConfig);
      }

      // Log metrics
      this.logOptimizationMetrics(prompt, optimizedPrompt, finalMode);

      this.log.info(`${operation} completed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
        inputLength: prompt.length,
        outputLength: optimizedPrompt.length,
        useConstitutionalAI,
        useIterativeRefinement,
      });

      return optimizedPrompt;

    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        this.log.info(`${operation} aborted`, {
          operation,
          duration: Math.round(performance.now() - startTime),
          mode: finalMode,
        });
        throw error;
      }
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
        promptLength: prompt.length,
      });
      throw error;
    }
  }

  /**
   * Iteratively refine a prompt until quality threshold is met
   */
  private async optimizeIteratively(
    prompt: string,
    mode: OptimizationMode,
    context: InferredContext | null,
    brainstormContext: Record<string, unknown> | null,
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
    
    this.log.debug(`Starting ${operation}`, {
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
        ? await strategy.generateDomainContent(currentPrompt, context)
        : null;
      const optimized = await strategy.optimize({
        prompt: currentPrompt,
        context,
        brainstormContext,
        domainContent,
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

    this.log.info(`${operation} complete`, {
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
    
    this.log.debug(`Starting ${operation}`, {
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
        this.log.debug(`${operation} skipped (sampled out)`, {
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

      this.log.debug(`${operation} completed - no revisions needed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });

      return prompt;
    } catch (error) {
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return prompt; // Return original on failure
    }
  }

  /**
   * Get draft system prompt for ChatGPT generation
   */
  private getDraftSystemPrompt(mode: OptimizationMode, shotPlan: ShotPlan | null = null): string {
    const planSummary = shotPlan
      ? `Respect this interpreted shot plan (do not force missing fields):
- shot_type: ${shotPlan.shot_type || 'unknown'}
- core_intent: ${shotPlan.core_intent || 'n/a'}
- subject: ${shotPlan.subject || 'null'}
- action: ${shotPlan.action || 'null'}
- visual_focus: ${shotPlan.visual_focus || 'null'}
- setting: ${shotPlan.setting || 'null'}
- camera_move: ${shotPlan.camera_move || 'null'}
- camera_angle: ${shotPlan.camera_angle || 'null'}
- lighting: ${shotPlan.lighting || 'null'}
- style: ${shotPlan.style || 'null'}
Keep ONE action and 75-125 words.`
      : 'Honor ONE action, camera-visible details, 75-125 words. Do not invent subjects or actions if absent.';

    const draftInstructions: Record<string, string> = {
      video: `You are a video prompt draft generator. Create a concise video prompt (75-125 words).

Focus on:
- Clear subject and primary action when present (otherwise lean on camera move + visual focus)
- Preserve explicit user-provided intent (including temporal changes like seasons shifting)
- Essential visual details (lighting, camera angle)
- Specific cinematographic style
- Avoid negative phrasing; describe what to show

${planSummary}

Output ONLY the draft prompt, no explanations or meta-commentary.`,

      reasoning: `You are a reasoning prompt draft generator. Create a concise structured prompt (100-150 words).

Include:
- Core problem statement
- Key analytical approach
- Expected reasoning pattern

Output ONLY the draft prompt, no explanations.`,

      research: `You are a research prompt draft generator. Create a focused research prompt (100-150 words).

Include:
- Research question
- Primary sources to consult
- Key evaluation criteria

Output ONLY the draft prompt, no explanations.`,

      socratic: `You are a Socratic teaching draft generator. Create a concise learning prompt (100-150 words).

Include:
- Learning objective
- Progressive question approach
- Key concepts to explore

Output ONLY the draft prompt, no explanations.`,

      optimize: `You are a prompt optimization draft generator. Create an improved prompt (100-150 words).

Make it:
- Clear and specific
- Action-oriented
- Well-structured

Output ONLY the draft prompt, no explanations.`
    };

    const fallback =
      draftInstructions.optimize ??
      draftInstructions.video ??
      'You are a prompt optimization draft generator. Create an improved prompt.';
    return draftInstructions[mode] ?? fallback;
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
   * Build cache key for optimization result
   */
  private buildCacheKey(
    prompt: string,
    mode: OptimizationMode,
    context: InferredContext | null,
    brainstormContext: Record<string, unknown> | null
  ): string {
    const parts = [
      'prompt-opt',
      mode,
      prompt.substring(0, 100),
      context ? JSON.stringify(context) : '',
      brainstormContext ? JSON.stringify(brainstormContext) : ''
    ];
    return parts.join('::');
  }

  private buildMetadataCacheKey(baseKey: string): string {
    return `${baseKey}::meta`;
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
