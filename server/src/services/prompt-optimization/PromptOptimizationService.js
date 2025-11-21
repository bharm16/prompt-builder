import { logger } from '../../infrastructure/Logger.js';
import { cacheService } from '../cache/CacheService.js';
import { TemperatureOptimizer } from '../../utils/TemperatureOptimizer.js';
import { ConstitutionalAI } from '../../utils/ConstitutionalAI.js';
import { labelSpans } from '../../llm/span-labeling/SpanLabelingService.js';
import OptimizationConfig from '../../config/OptimizationConfig.js';

// Import specialized services
import { ContextInferenceService } from './services/ContextInferenceService.js';
import { ModeDetectionService } from './services/ModeDetectionService.js';
import { QualityAssessmentService } from './services/QualityAssessmentService.js';
import { StrategyFactory } from './services/StrategyFactory.js';
import { templateService } from './services/TemplateService.js';

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
  constructor(aiService) {
    this.ai = aiService;

    // Initialize specialized services
    this.contextInference = new ContextInferenceService(aiService);
    this.modeDetection = new ModeDetectionService(aiService);
    this.qualityAssessment = new QualityAssessmentService(aiService);
    this.strategyFactory = new StrategyFactory(aiService, templateService);

    // Cache configuration
    this.cacheConfig = cacheService.getConfig(OptimizationConfig.cache.promptOptimization);

    // Template versions (moved to config)
    this.templateVersions = OptimizationConfig.templateVersions;

    logger.info('PromptOptimizationService initialized with refactored architecture', {
      availableClients: this.ai.getAvailableClients(),
      strategies: this.strategyFactory.getSupportedModes()
    });
  }

  /**
   * Two-stage optimization: Fast draft with Groq + Quality refinement with primary model
   *
   * Stage 1 (Groq): Generate concise draft in ~200-500ms
   * Stage 2 (Primary Model): Refine draft in background
   *
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - User's original prompt
   * @param {string} params.mode - Optimization mode
   * @param {Object} params.context - Optional context
   * @param {Object} params.brainstormContext - Optional brainstorm context
   * @param {Function} params.onDraft - Callback when draft is ready
   * @returns {Promise<{draft: string, refined: string, metadata: Object}>}
   */
  async optimizeTwoStage({ prompt, mode, context = null, brainstormContext = null, onDraft = null }) {
    // Default to video mode (only mode supported)
    if (!mode) {
      mode = 'video';
    } else if (mode !== 'video') {
      logger.warn('Non-video mode specified, defaulting to video', { requestedMode: mode });
      mode = 'video';
    }

    logger.info('Starting two-stage optimization', { mode });

    // Check if draft operation supports streaming (Groq available)
    if (!this.ai.supportsStreaming('optimize_draft')) {
      logger.warn('Draft streaming not available, falling back to single-stage optimization');
      const result = await this.optimize({ prompt, mode, context, brainstormContext });
      return { draft: result, refined: result, usedFallback: true };
    }

    const startTime = Date.now();

    try {
      // STAGE 1: Generate fast draft with Groq + parallel span labeling (200-500ms)
      const draftSystemPrompt = this.getDraftSystemPrompt(mode);
      logger.debug('Generating draft with Groq', { mode });
      const draftStartTime = Date.now();

      // Start operations in parallel
      const operations = [
        this.ai.execute('optimize_draft', {
          systemPrompt: draftSystemPrompt,
          userMessage: prompt,
          maxTokens: OptimizationConfig.tokens.draft[mode] || OptimizationConfig.tokens.draft.default,
          temperature: OptimizationConfig.temperatures.draft,
          timeout: OptimizationConfig.timeouts.draft,
        }),
        // Only do span labeling for video mode
        mode === 'video' ? labelSpans({
          text: prompt,
          maxSpans: OptimizationConfig.spanLabeling.maxSpans,
          minConfidence: OptimizationConfig.spanLabeling.minConfidence,
          templateVersion: OptimizationConfig.spanLabeling.templateVersion,
        }).catch(err => {
          logger.warn('Parallel span labeling failed, will retry after draft', { error: err.message });
          return null;
        }) : Promise.resolve(null)
      ];

      const [draftResponse, initialSpans] = await Promise.all(operations);

      const draft = draftResponse.content[0]?.text || '';
      const draftDuration = Date.now() - draftStartTime;

      logger.info('Draft generated successfully', {
        duration: draftDuration,
        draftLength: draft.length,
        hasSpans: !!initialSpans,
        mode
      });

      // Call onDraft callback
      if (onDraft && typeof onDraft === 'function') {
        const safeSpans = initialSpans || { spans: [], meta: null };
        onDraft(draft, safeSpans);
      }

      // STAGE 2: Refine with primary model (background)
      logger.debug('Starting refinement with primary model', { mode });
      const refinementStartTime = Date.now();

      const refined = await this.optimize({
        prompt: draft, // Use draft as input for refinement
        mode,
        context,
        brainstormContext,
      });

      const refinementDuration = Date.now() - refinementStartTime;
      const totalDuration = Date.now() - startTime;

      logger.info('Two-stage optimization complete', {
        draftDuration,
        refinementDuration,
        totalDuration,
        mode,
        hasSpans: !!initialSpans
      });

      return {
        draft,
        refined,
        draftSpans: initialSpans,
        refinedSpans: null, // Skip for performance
        metadata: {
          draftDuration,
          refinementDuration,
          totalDuration,
          mode,
          usedTwoStage: true,
        }
      };

    } catch (error) {
      logger.error('Two-stage optimization failed, falling back to single-stage', {
        error: error.message,
        mode
      });

      const result = await this.optimize({ prompt, mode, context, brainstormContext });
      return {
        draft: result,
        refined: result,
        usedFallback: true,
        error: error.message
      };
    }
  }

  /**
   * Main optimization method - delegates to appropriate strategy
   *
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - User's prompt to optimize
   * @param {string} params.mode - Optimization mode (always defaults to 'video')
   * @param {Object} params.context - Optional user-provided context
   * @param {Object} params.brainstormContext - Optional brainstorm context
   * @param {boolean} params.useConstitutionalAI - Optional constitutional AI review
   * @param {boolean} params.useIterativeRefinement - Optional iterative refinement
   * @returns {Promise<string>} Optimized prompt
   */
  async optimize({
    prompt,
    mode,
    context = null,
    brainstormContext = null,
    useConstitutionalAI = false,
    useIterativeRefinement = false
  }) {
    // Default to video mode (only mode supported)
    if (!mode) {
      mode = 'video';
      logger.debug('Mode not specified, defaulting to video');
    } else if (mode !== 'video') {
      logger.warn('Non-video mode specified, defaulting to video', { requestedMode: mode });
      mode = 'video';
    }

    logger.info('Starting optimization', { mode, hasContext: !!context });

    // Check cache
    const cacheKey = this.buildCacheKey(prompt, mode, context, brainstormContext);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.info('Returning cached optimization result', { mode });
      return cached;
    }

    try {
      let optimizedPrompt;

      // Use iterative refinement if requested
      if (useIterativeRefinement) {
        optimizedPrompt = await this.optimizeIteratively(
          prompt,
          mode,
          context,
          brainstormContext,
          useConstitutionalAI
        );
      } else {
        // Get appropriate strategy and optimize
        const strategy = this.strategyFactory.getStrategy(mode);

        // Generate domain content if strategy supports it
        const domainContent = await strategy.generateDomainContent(prompt, context);

        // Optimize using strategy
        optimizedPrompt = await strategy.optimize({
          prompt,
          context,
          brainstormContext,
          domainContent
        });

        // Apply constitutional AI review if requested
        if (useConstitutionalAI) {
          optimizedPrompt = await this.applyConstitutionalAI(optimizedPrompt, mode);
        }
      }

      // Cache the result
      await cacheService.set(cacheKey, optimizedPrompt, this.cacheConfig);

      // Log metrics
      this.logOptimizationMetrics(prompt, optimizedPrompt, mode);

      return optimizedPrompt;

    } catch (error) {
      logger.error('Optimization failed', {
        mode,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Iteratively refine a prompt until quality threshold is met
   * @private
   */
  async optimizeIteratively(prompt, mode, context, brainstormContext, useConstitutionalAI) {
    logger.info('Starting iterative optimization', { mode });

    const maxIterations = OptimizationConfig.iterativeRefinement.maxIterations;
    const targetScore = OptimizationConfig.quality.targetScore;
    const improvementThreshold = OptimizationConfig.iterativeRefinement.improvementThreshold;

    let currentPrompt = prompt;
    let bestPrompt = prompt;
    let bestScore = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      logger.debug('Iteration starting', { iteration, currentScore: bestScore });

      // Optimize
      const strategy = this.strategyFactory.getStrategy(mode);
      const domainContent = await strategy.generateDomainContent(currentPrompt, context);
      const optimized = await strategy.optimize({
        prompt: currentPrompt,
        context,
        brainstormContext,
        domainContent
      });

      // Apply constitutional AI if requested
      const finalOptimized = useConstitutionalAI
        ? await this.applyConstitutionalAI(optimized, mode)
        : optimized;

      // Assess quality
      const assessment = await this.qualityAssessment.assessQuality(finalOptimized, mode);

      // Update best if improved
      if (assessment.score > bestScore) {
        bestScore = assessment.score;
        bestPrompt = finalOptimized;
        logger.info('Iteration improved quality', { iteration, score: bestScore });
      }

      // Stop if target reached
      if (assessment.score >= targetScore) {
        logger.info('Target quality reached', { iteration, score: bestScore });
        break;
      }

      // Stop if improvement is marginal
      if (iteration > 0 && (assessment.score - bestScore) < improvementThreshold) {
        logger.info('Marginal improvement, stopping', { iteration });
        break;
      }

      currentPrompt = finalOptimized;
    }

    logger.info('Iterative optimization complete', {
      finalScore: bestScore,
      iterations: maxIterations
    });

    return bestPrompt;
  }

  /**
   * Apply constitutional AI review to optimized prompt
   * @private
   */
  async applyConstitutionalAI(prompt, mode) {
    logger.debug('Applying constitutional AI review', { mode });

    try {
      const constitutionalAI = new ConstitutionalAI(this.ai);
      const reviewResult = await constitutionalAI.review(prompt);

      if (reviewResult.revised) {
        logger.info('Constitutional AI suggested revisions', {
          violationCount: reviewResult.violations?.length || 0
        });
        return reviewResult.revised;
      }

      return prompt;
    } catch (error) {
      logger.error('Constitutional AI review failed', { error: error.message });
      return prompt; // Return original on failure
    }
  }

  /**
   * Get draft system prompt for Groq generation
   * @private
   */
  getDraftSystemPrompt(mode) {
    const draftInstructions = {
      video: `You are a video prompt draft generator. Create a concise video prompt (75-125 words).

Focus on:
- Clear subject and primary action
- Essential visual details (lighting, camera angle)
- Specific cinematographic style

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

    return draftInstructions[mode] || draftInstructions.optimize;
  }

  /**
   * Automatically detect optimal mode for a prompt
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<string>} Detected mode
   */
  async detectOptimalMode(prompt) {
    return this.modeDetection.detectMode(prompt);
  }

  /**
   * Infer context from a prompt
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<Object>} Inferred context
   */
  async inferContextFromPrompt(prompt) {
    return this.contextInference.inferContext(prompt);
  }

  /**
   * Assess the quality of a prompt
   * @param {string} prompt - The prompt to assess
   * @param {string} mode - The optimization mode
   * @returns {Promise<Object>} Quality assessment
   */
  async assessPromptQuality(prompt, mode) {
    return this.qualityAssessment.assessQuality(prompt, mode);
  }

  /**
   * Build cache key for optimization result
   * @private
   */
  buildCacheKey(prompt, mode, context, brainstormContext) {
    const parts = [
      'prompt-opt',
      mode,
      prompt.substring(0, 100),
      context ? JSON.stringify(context) : '',
      brainstormContext ? JSON.stringify(brainstormContext) : ''
    ];
    return parts.join('::');
  }

  /**
   * Log optimization metrics
   * @private
   */
  logOptimizationMetrics(originalPrompt, optimizedPrompt, mode) {
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

