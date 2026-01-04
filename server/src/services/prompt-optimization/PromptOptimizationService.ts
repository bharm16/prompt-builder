import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { cacheService } from '@services/cache/CacheService';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { ConstitutionalAI } from '@utils/ConstitutionalAI';
import OptimizationConfig from '@config/OptimizationConfig';
import crypto from 'crypto';

// Import specialized services
import { ContextInferenceService } from './services/ContextInferenceService';
import { ModeDetectionService } from './services/ModeDetectionService';
import { QualityAssessmentService } from './services/QualityAssessmentService';
import { StrategyFactory } from './services/StrategyFactory';
import { ShotInterpreterService } from './services/ShotInterpreterService';
import { templateService } from './services/TemplateService';
import { VideoPromptService } from '../video-prompt-analysis/VideoPromptService';
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
    private readonly videoPromptService: VideoPromptService | null;
    private readonly cacheConfig: { ttl: number; namespace: string };
    private readonly templateVersions: typeof OptimizationConfig.templateVersions;
    private readonly log: ILogger;
  
    constructor(aiService: AIService, videoPromptService: VideoPromptService | null = null) {
      this.ai = aiService;
      this.videoPromptService = videoPromptService;
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
    mode: _mode,
    targetModel,
    context = null,
    brainstormContext = null,
    generationParams = null,
    skipCache = false,
    lockedSpans = [],
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
    void _mode;
    
    const finalMode: OptimizationMode = 'video';

    this.log.debug(`Starting ${operation}`, {
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
    if (!this.ai.supportsStreaming?.('optimize_draft')) {
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
      return {
        draft: result,
        refined: result,
        metadata: { usedFallback: true, ...(fallbackMetadata || {}) },
      };
    }

    try {
      // STAGE 1: Generate fast draft with ChatGPT (1-3s)
      const draftSystemPrompt = this.getDraftSystemPrompt(finalMode, shotPlan, generationParams);
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
    signal,
    targetModel, // Extract targetModel
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
    void _mode;
    
    const finalMode: OptimizationMode = 'video';

    this.log.debug(`Starting ${operation}`, {
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
    const cacheKey = this.buildCacheKey(
      prompt,
      finalMode,
      context,
      brainstormContext,
      targetModel,
      generationParams,
      lockedSpans
    );
    const cacheMetadataKey = this.buildMetadataCacheKey(cacheKey);
    if (!skipCache) {
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
    } else {
      this.log.debug('Skipping optimization cache', {
        operation,
        mode: finalMode,
      });
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
          ...(signal ? { signal } : {}),
        });

        // Apply constitutional AI review if requested
        if (useConstitutionalAI) {
          optimizedPrompt = await this.applyConstitutionalAI(optimizedPrompt, finalMode, signal);
        }
      }

      // STAGE 3: Model-Specific Compilation (The "Compiler" Phase)
      // If we are in video mode and have the video service, compile the generic LLM output
      // into the exact syntax required by the target model (Runway, Luma, Veo, etc.)
      if (finalMode === 'video' && this.videoPromptService) {
        // 1. Determine target model (explicit request > detection)
        // Ensure we treat empty string as "Auto-detect" (null/undefined/empty)
        const explicitModel = targetModel && targetModel.trim() !== '' ? targetModel : undefined;
        
        // Resolve explicit model ID to full strategy ID if needed
        let resolvedTargetModel = explicitModel;
        if (resolvedTargetModel && VideoPromptService.MODEL_ID_MAP[resolvedTargetModel]) {
          resolvedTargetModel = VideoPromptService.MODEL_ID_MAP[resolvedTargetModel];
        }

        // Only detect if no explicit model was provided
        if (!resolvedTargetModel) {
          resolvedTargetModel = (this.videoPromptService.detectTargetModel(prompt) || 
                                this.videoPromptService.detectTargetModel(optimizedPrompt)) ?? undefined; // Check both inputs
        }
        
        if (resolvedTargetModel) {
          this.log.info('Compiling prompt for target model', {
            operation,
            targetModel: resolvedTargetModel,
            genericLength: optimizedPrompt.length
          });

          try {
            // Extract core narrative from the formatted prompt
            // The formatted prompt usually looks like:
            // "Visual description paragraph...\n\n**TECHNICAL SPECS**\n..."
            // We only want the description for the compiler.
            const narrativePrompt = optimizedPrompt.split(/\*\*TECHNICAL SPECS\*\*/i)[0]?.trim() || optimizedPrompt;

            // 2. Compile using the Strategy Pipeline (Analyzer -> IR -> Synthesizer)
            // This applies CSAE, JSON schemas, physics tokens, etc.
            const compilationResult = await this.videoPromptService.optimizeForModel(
              narrativePrompt, // Use clean narrative
              resolvedTargetModel
            );

            // 3. Update the prompt with the compiled version
            // For JSON outputs (Veo), this will be a stringified object
            const compiledPrompt = typeof compilationResult.prompt === 'string'
              ? compilationResult.prompt
              : JSON.stringify(compilationResult.prompt, null, 2);

            this.log.info('Prompt compiled successfully', {
              operation,
              targetModel: resolvedTargetModel,
              compiledLength: compiledPrompt.length,
              changes: compilationResult.metadata.phases.flatMap(p => p.changes).length
            });

            optimizedPrompt = compiledPrompt;

            // Merge compilation metadata
            handleMetadata({
              compiledFor: resolvedTargetModel,
              compilationMeta: compilationResult.metadata
            });

          } catch (compilationError) {
            this.log.error('Model compilation failed, reverting to generic optimization', compilationError as Error, {
              operation,
              targetModel: resolvedTargetModel
            });
            // Fallback: optimizedPrompt remains the generic LLM output
          }
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
    lockedSpans: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }> | null,
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
        domainContent: domainContent as string | null,
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
  private getDraftSystemPrompt(
    mode: OptimizationMode,
    shotPlan: ShotPlan | null = null,
    generationParams: Record<string, any> | null = null
  ): string {
    let constraints = '';
    if (generationParams) {
      const overrides = [];
      if (generationParams.aspect_ratio) overrides.push(`Aspect Ratio: ${generationParams.aspect_ratio}`);
      if (generationParams.duration_s) overrides.push(`Duration: ${generationParams.duration_s}s`);
      if (generationParams.fps) overrides.push(`Frame Rate: ${generationParams.fps}fps`);
      if (typeof generationParams.audio === 'boolean') overrides.push(`Audio: ${generationParams.audio ? 'Enabled' : 'Muted'}`);
      
      if (overrides.length > 0) {
        constraints = `\nRespect these user constraints: ${overrides.join(', ')}.`;
      }
    }

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
Keep ONE action and 75-125 words.${constraints}`
      : `Honor ONE action, camera-visible details, 75-125 words. Do not invent subjects or actions if absent.${constraints}`;

    const draftInstructions: Record<string, string> = {
      video: `You are a video prompt draft generator. Create a concise video prompt (75-125 words).

Focus on:
- Clear subject and primary action when present (otherwise lean on camera move + visual focus)
- Preserve explicit user-provided intent (including temporal changes like seasons shifting)
- Essential visual details (lighting, camera angle)
- Specific cinematographic style
- Avoid negative phrasing; describe what to show

${planSummary}

Output ONLY the draft prompt, no explanations or meta-commentary.`
    };

    return draftInstructions[mode] ?? draftInstructions.video;
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
    brainstormContext: Record<string, unknown> | null,
    targetModel?: string,
    generationParams?: Record<string, unknown> | null,
    lockedSpans?: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>
  ): string {
    const lockedSpanSignature = this.buildLockedSpanSignature(lockedSpans);
    const generationSignature = this.buildGenerationParamsSignature(generationParams);
    const parts = [
      'prompt-opt-v3', // Bump version to clear generic caches and force compilation refresh
      mode,
      targetModel || 'generic',
      prompt.substring(0, 100),
      context ? JSON.stringify(context) : '',
      brainstormContext ? JSON.stringify(brainstormContext) : '',
      generationSignature,
    ];
    if (lockedSpanSignature) {
      parts.push(`locked:${lockedSpanSignature}`);
    }
    return parts.join('::');
  }

  private buildLockedSpanSignature(
    lockedSpans?: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null }>
  ): string {
    if (!lockedSpans || lockedSpans.length === 0) {
      return '';
    }
    const payload = lockedSpans.map((span) => ({
      text: span.text,
      leftCtx: span.leftCtx ?? null,
      rightCtx: span.rightCtx ?? null,
    }));
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
  }

  private buildMetadataCacheKey(baseKey: string): string {
    return `${baseKey}::meta`;
  }

  private buildGenerationParamsSignature(params?: Record<string, unknown> | null): string {
    if (!params || typeof params !== 'object') {
      return '';
    }
    const sortedEntries = Object.keys(params)
      .sort()
      .map((key) => [key, (params as Record<string, unknown>)[key]]);
    return JSON.stringify(sortedEntries);
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
