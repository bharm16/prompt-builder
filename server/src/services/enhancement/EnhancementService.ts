import { logger } from '@infrastructure/Logger.js';
import { cacheService } from '../cache/CacheService.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer.js';
import { getEnhancementSchema, getCustomSuggestionSchema } from './config/schemas.js';
import { FallbackRegenerationService } from './services/FallbackRegenerationService.js';
import { SuggestionProcessor } from './services/SuggestionProcessor.js';
import { StyleTransferService } from './services/StyleTransferService.js';
import { ContrastiveDiversityEnforcer } from './services/ContrastiveDiversityEnforcer.js';
import { EnhancementMetricsService } from './services/EnhancementMetricsService.js';
import { PROMPT_MODES, POISONOUS_PATTERNS } from './constants.js';
import type {
  AIService,
  VideoService,
  PlaceholderDetector,
  BrainstormBuilder,
  PromptBuilder,
  ValidationService,
  DiversityEnforcer,
  CategoryAligner,
  MetricsService,
  EnhancementRequestParams,
  CustomSuggestionRequestParams,
  EnhancementResult,
  EnhancementMetrics,
  Suggestion,
  VideoConstraints,
  CategoryAlignmentResult,
  BrainstormContext,
  PromptBuildParams,
  GroupedSuggestions,
} from './services/types.js';

/**
 * EnhancementService - Main Orchestrator
 *
 * Coordinates enhancement suggestion generation by delegating to specialized services.
 * This service focuses purely on orchestration.
 *
 * Single Responsibility: Orchestrate the enhancement suggestion workflow
 */
export class EnhancementService {
  private readonly ai: AIService;
  private readonly placeholderDetector: PlaceholderDetector;
  private readonly videoService: VideoService;
  private readonly brainstormBuilder: BrainstormBuilder;
  private readonly promptBuilder: PromptBuilder;
  private readonly validationService: ValidationService;
  private readonly diversityEnforcer: DiversityEnforcer;
  private readonly categoryAligner: CategoryAligner;
  private readonly metricsService: MetricsService | null;
  private readonly cacheConfig: { ttl: number; namespace: string };
  private readonly fallbackRegeneration: FallbackRegenerationService;
  private readonly suggestionProcessor: SuggestionProcessor;
  private readonly styleTransfer: StyleTransferService;
  private readonly contrastiveDiversity: ContrastiveDiversityEnforcer;
  private readonly metricsLogger: EnhancementMetricsService;

  constructor(
    aiService: AIService,
    placeholderDetector: PlaceholderDetector,
    videoService: VideoService,
    brainstormBuilder: BrainstormBuilder,
    promptBuilder: PromptBuilder,
    validationService: ValidationService,
    diversityEnforcer: DiversityEnforcer,
    categoryAligner: CategoryAligner,
    metricsService: MetricsService | null = null
  ) {
    this.ai = aiService;
    this.placeholderDetector = placeholderDetector;
    this.videoService = videoService;
    this.brainstormBuilder = brainstormBuilder;
    this.promptBuilder = promptBuilder;
    this.validationService = validationService;
    this.diversityEnforcer = diversityEnforcer;
    this.categoryAligner = categoryAligner;
    this.metricsService = metricsService;
    this.cacheConfig = cacheService.getConfig('enhancement') || {
      ttl: 3600,
      namespace: 'enhancement',
    };

    // Initialize specialized services
    this.fallbackRegeneration = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer
    );
    this.suggestionProcessor = new SuggestionProcessor(validationService);
    this.styleTransfer = new StyleTransferService(aiService);
    this.contrastiveDiversity = new ContrastiveDiversityEnforcer(aiService);
    this.metricsLogger = new EnhancementMetricsService(metricsService);
  }

  /**
   * Get enhancement suggestions for highlighted text
   */
  async getEnhancementSuggestions({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    brainstormContext,
    highlightedCategory,
    highlightedCategoryConfidence,
    highlightedPhrase,
    editHistory = [],
  }: EnhancementRequestParams): Promise<EnhancementResult> {
    const metrics: EnhancementMetrics = {
      total: 0,
      cache: false,
      cacheCheck: 0,
      modelDetection: 0,
      sectionDetection: 0,
      promptBuild: 0,
      groqCall: 0,
      postProcessing: 0,
      promptMode: PROMPT_MODES.ENHANCEMENT,
    };
    const startTotal = Date.now();

    let isVideoPrompt = false;
    let modelTarget: string | null = null;
    let promptSection: string | null = null;

    try {
      logger.info('Getting enhancement suggestions', {
        highlightedLength: highlightedText?.length,
        highlightedCategory: highlightedCategory || null,
        categoryConfidence: highlightedCategoryConfidence ?? null,
        highlightedPhrasePreview: highlightedPhrase
          ? String(highlightedPhrase).slice(0, 80)
          : undefined,
      });

      const videoContext = this._detectVideoContext({
        fullPrompt,
        highlightedText,
        contextBefore,
        contextAfter,
        highlightedCategory: highlightedCategory ?? null,
        highlightedCategoryConfidence: highlightedCategoryConfidence ?? null,
        metrics,
      });
      
      isVideoPrompt = videoContext.isVideoPrompt;
      modelTarget = videoContext.modelTarget;
      promptSection = videoContext.promptSection;
      const brainstormSignature = this.brainstormBuilder.buildBrainstormSignature(brainstormContext ?? null);
      const highlightWordCount = videoContext.highlightWordCount;
      const phraseRole = videoContext.phraseRole;
      const videoConstraints = videoContext.videoConstraints;

      const cacheStart = Date.now();
      const cacheKey = this._generateCacheKey({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        isVideoPrompt,
        brainstormSignature,
        highlightedCategory: highlightedCategory ?? null,
        highlightWordCount,
        phraseRole,
        videoConstraints,
        editHistory,
        modelTarget,
        promptSection,
      });

      const cached = await cacheService.get<EnhancementResult>(cacheKey, 'enhancement');
      metrics.cacheCheck = Date.now() - cacheStart;

      if (cached) {
        metrics.cache = true;
        metrics.total = Date.now() - startTotal;
        metrics.promptMode = PROMPT_MODES.ENHANCEMENT;
        this.metricsLogger.logMetrics(metrics, {
          highlightedCategory: highlightedCategory ?? null,
          isVideoPrompt,
          modelTarget,
          promptSection,
        });
        logger.debug('Cache hit for enhancement suggestions', {
          cacheCheckTime: metrics.cacheCheck,
          totalTime: metrics.total,
          promptMode: metrics.promptMode,
        });
        return cached;
      }

      const isPlaceholder = this.placeholderDetector.detectPlaceholder(
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt
      );

      const promptBuildStart = Date.now();
      const promptBuilderInput = {
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        brainstormContext: brainstormContext ?? null,
        editHistory,
        modelTarget,
        isVideoPrompt,
        phraseRole,
        highlightedCategory: highlightedCategory ?? null,
        promptSection,
        videoConstraints,
        highlightWordCount,
        isPlaceholder,
      };
      const systemPrompt = isPlaceholder
        ? this.promptBuilder.buildPlaceholderPrompt(promptBuilderInput)
        : this.promptBuilder.buildRewritePrompt(promptBuilderInput);
      metrics.promptBuild = Date.now() - promptBuildStart;

      const schema = getEnhancementSchema(isPlaceholder);
      const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
        diversity: 'high',
        precision: 'medium',
      });

      const generationResult = await this._generateSuggestions({
        systemPrompt,
        schema: schema as Record<string, unknown>,
        isVideoPrompt,
        isPlaceholder,
        highlightedText,
        temperature,
        metrics,
      });
      
      const suggestions = generationResult.suggestions;
      metrics.groqCall = generationResult.groqCallTime;
      metrics.usedContrastiveDecoding = generationResult.usedContrastiveDecoding;

      const postStart = Date.now();
      const processingResult = await this._processSuggestions({
        suggestions: suggestions ?? [],
        highlightedCategory: highlightedCategory ?? null,
        highlightedText,
        highlightedCategoryConfidence: highlightedCategoryConfidence ?? null,
        isPlaceholder,
        isVideoPrompt,
        videoConstraints,
        phraseRole,
        highlightWordCount,
        schema: schema as Record<string, unknown>,
        temperature,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        brainstormContext: brainstormContext ?? null,
        editHistory,
        modelTarget,
        promptSection,
      });

      const result = this._buildEnhancementResult({
        suggestionsToUse: processingResult.suggestionsToUse,
        activeConstraints: processingResult.activeConstraints,
        alignmentFallbackApplied: processingResult.alignmentFallbackApplied,
        usedFallback: processingResult.usedFallback,
        isPlaceholder,
        phraseRole,
      });

      metrics.postProcessing = Date.now() - postStart;

      // Note: sanitizedSuggestions not available here after extraction, using suggestionsToUse instead
      this.suggestionProcessor.logResult(
        result,
        processingResult.suggestionsToUse,
        processingResult.usedFallback,
        processingResult.fallbackSourceCount,
        suggestions ?? []
      );

      await cacheService.set(cacheKey, result, {
        ttl: this.cacheConfig.ttl,
      });

      metrics.total = Date.now() - startTotal;
      metrics.promptMode = PROMPT_MODES.ENHANCEMENT;
      this.metricsLogger.logMetrics(metrics, {
        highlightedCategory: highlightedCategory ?? null,
        isVideoPrompt,
        modelTarget,
        promptSection,
      });
      this.metricsLogger.checkLatency(metrics);

      return result;
    } catch (error) {
      metrics.total = Date.now() - startTotal;
      metrics.promptMode = PROMPT_MODES.ENHANCEMENT;
      this.metricsLogger.logMetrics(
        metrics,
        {
          highlightedCategory: highlightedCategory ?? null,
          isVideoPrompt,
          modelTarget,
          promptSection,
        },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Get custom suggestions based on user request
   */
  async getCustomSuggestions({ 
    highlightedText, 
    customRequest, 
    fullPrompt 
  }: CustomSuggestionRequestParams): Promise<{ suggestions: Suggestion[] }> {
    logger.info('Getting custom suggestions', {
      request: customRequest,
      highlightedLength: highlightedText?.length,
    });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText,
      customRequest,
      fullPrompt: fullPrompt.substring(0, 500),
    });

    const cached = await cacheService.get<{ suggestions: Suggestion[] }>(cacheKey, 'enhancement');
    if (cached) {
      logger.debug('Cache hit for custom suggestions');
      return cached;
    }

    // Detect video prompt
    const isVideoPrompt = this.videoService.isVideoPrompt(fullPrompt);

    // Build prompt
    const systemPrompt = this.promptBuilder.buildCustomPrompt({
      highlightedText,
      customRequest,
      fullPrompt,
      isVideoPrompt,
    });

    // Generate suggestions
    const schema = getCustomSuggestionSchema();
    const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
    });

    // Create adapter for StructuredOutputEnforcer compatibility
    // StructuredOutputEnforcer._callAIService adds systemPrompt to options
    const aiAdapter = {
      execute: async (operation: string, options: Record<string, unknown>) => {
        const executeParams: Parameters<AIService['execute']>[1] = {
          systemPrompt: options.systemPrompt as string,
        };
        if (options.userMessage) executeParams.userMessage = options.userMessage as string;
        if (options.temperature !== undefined) executeParams.temperature = options.temperature as number;
        if (options.maxTokens !== undefined) executeParams.maxTokens = options.maxTokens as number;
        
        const response = await this.ai.execute(operation, executeParams);
        // Convert AIResponse to AIServiceResponse format
        return {
          text: response.text,
          content: [{ text: response.text }],
        };
      },
    };
    
    const suggestions = await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
      aiAdapter,
      systemPrompt,
      {
        operation: 'custom_suggestions',
        schema: schema as { type: 'object' | 'array'; required?: string[]; items?: { required?: string[] } } | null,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Process suggestions
    const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(suggestions);

    const result = { suggestions: diverseSuggestions };

    // Cache result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Custom suggestions generated', {
      count: diverseSuggestions.length,
      diversityEnforced: diverseSuggestions.length !== suggestions.length,
    });

    return result;
  }

  /**
   * Transfer text from one style to another
   */
  async transferStyle(text: string, targetStyle: string): Promise<string> {
    return this.styleTransfer.transferStyle(text, targetStyle);
  }

  /**
   * Detect video context and extract video-specific information
   * @private
   */
  private _detectVideoContext(params: {
    fullPrompt: string;
    highlightedText: string;
    contextBefore: string;
    contextAfter: string;
    highlightedCategory: string | null;
    highlightedCategoryConfidence: number | null | undefined;
    metrics: EnhancementMetrics;
  }): {
    isVideoPrompt: boolean;
    modelTarget: string | null;
    promptSection: string | null;
    highlightWordCount: number;
    phraseRole: string | null;
    videoConstraints: VideoConstraints | null;
  } {
    const isVideoPrompt = this.videoService.isVideoPrompt(params.fullPrompt);
    const highlightWordCount = this.videoService.countWords(params.highlightedText);
    const phraseRole = isVideoPrompt
      ? this.videoService.detectVideoPhraseRole(
          params.highlightedText,
          params.contextBefore,
          params.contextAfter,
          params.highlightedCategory
        )
      : null;
    const videoConstraints = isVideoPrompt
      ? this.videoService.getVideoReplacementConstraints({
          highlightWordCount,
          phraseRole,
          highlightedText: params.highlightedText,
          highlightedCategory: params.highlightedCategory,
          highlightedCategoryConfidence: params.highlightedCategoryConfidence ?? null,
        })
      : null;

    let modelTarget: string | null = null;
    let promptSection: string | null = null;

    if (isVideoPrompt) {
      const modelStart = Date.now();
      modelTarget = this.videoService.detectTargetModel(params.fullPrompt);
      params.metrics.modelDetection = Date.now() - modelStart;

      const sectionStart = Date.now();
      promptSection = this.videoService.detectPromptSection(
        params.highlightedText,
        params.fullPrompt,
        params.contextBefore
      );
      params.metrics.sectionDetection = Date.now() - sectionStart;
    }

    logger.debug('Model and section detection', {
      isVideoPrompt,
      modelTarget: modelTarget || 'none detected',
      promptSection: promptSection || 'main_prompt',
      modelDetectionTime: params.metrics.modelDetection,
      sectionDetectionTime: params.metrics.sectionDetection,
    });

    return {
      isVideoPrompt,
      modelTarget,
      promptSection,
      highlightWordCount,
      phraseRole,
      videoConstraints,
    };
  }

  /**
   * Generate suggestions using contrastive decoding or standard generation
   * @private
   */
  private async _generateSuggestions(params: {
    systemPrompt: string;
    schema: Record<string, unknown>;
    isVideoPrompt: boolean;
    isPlaceholder: boolean;
    highlightedText: string;
    temperature: number;
    metrics: EnhancementMetrics;
  }): Promise<{
    suggestions: Suggestion[] | null;
    groqCallTime: number;
    usedContrastiveDecoding: boolean;
  }> {
    const groqStart = Date.now();
    
    // PDF Enhancement: Try contrastive decoding for enhanced diversity
    let suggestions: Suggestion[] | null = await this.contrastiveDiversity.generateWithContrastiveDecoding({
      systemPrompt: params.systemPrompt,
      schema: params.schema,
      isVideoPrompt: params.isVideoPrompt,
      isPlaceholder: params.isPlaceholder,
      highlightedText: params.highlightedText,
    });
    
    let usedContrastiveDecoding = false;
    
    // Fallback to standard generation if contrastive decoding not used/failed
    if (!suggestions) {
      // Create adapter for StructuredOutputEnforcer compatibility
      const aiAdapter = {
        execute: async (operation: string, options: Record<string, unknown>) => {
          const response = await this.ai.execute(operation, {
            systemPrompt: options.systemPrompt as string,
            ...options,
          } as Parameters<AIService['execute']>[1]);
          // Convert AIResponse to AIServiceResponse format
          return {
            text: response.text,
            content: [{ text: response.text }],
          };
        },
      };
      
      suggestions = await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
        aiAdapter,
        params.systemPrompt,
        {
          schema: params.schema as { type: 'object' | 'array'; required?: string[]; items?: { required?: string[] } } | null,
          isArray: true,
          maxTokens: 2048,
          maxRetries: 2,
          temperature: params.temperature,
          operation: 'enhance_suggestions',
        }
      );
    } else {
      usedContrastiveDecoding = true;
      
      // Calculate and log diversity metrics
      const diversityMetrics = this.contrastiveDiversity.calculateDiversityMetrics(suggestions);
      logger.info('Contrastive decoding diversity metrics', {
        avgSimilarity: diversityMetrics.avgSimilarity,
        minSimilarity: diversityMetrics.minSimilarity,
        maxSimilarity: diversityMetrics.maxSimilarity,
        pairCount: diversityMetrics.pairCount,
      });
    }

    const groqCallTime = Date.now() - groqStart;

    // Check for poisonous patterns
    const poisonousPatterns = POISONOUS_PATTERNS;
    const hasPoisonousText = Array.isArray(suggestions) && suggestions.some((s) =>
      poisonousPatterns.some((pattern) =>
        s.text?.toLowerCase().includes(pattern.toLowerCase()) ||
        s.text?.toLowerCase() === pattern.toLowerCase()
      )
    );

    const sampleSuggestions = Array.isArray(suggestions)
      ? suggestions.slice(0, 3).map((s) => s.text)
      : [];

      logger.info('Raw suggestions from Claude', {
      isPlaceholder: params.isPlaceholder,
      suggestionsCount: Array.isArray(suggestions) ? suggestions.length : 0,
      hasCategory: suggestions?.[0]?.category !== undefined,
      zeroShotActive: true,
      hasPoisonousText,
      sampleSuggestions,
    });

    if (hasPoisonousText && Array.isArray(suggestions)) {
      logger.warn('ALERT: Poisonous example patterns detected in zero-shot suggestions!', {
        highlightedText: params.highlightedText,
        suggestions: suggestions.map((s) => s.text),
      });
    }

    return {
      suggestions,
      groqCallTime,
      usedContrastiveDecoding,
    };
  }

  /**
   * Process suggestions through diversity, alignment, sanitization, and fallback
   * @private
   */
  private async _processSuggestions(params: {
    suggestions: Suggestion[];
    highlightedCategory: string | null;
    highlightedText: string;
    highlightedCategoryConfidence: number | null | undefined;
    isPlaceholder: boolean;
    isVideoPrompt: boolean;
    videoConstraints: VideoConstraints | null;
    phraseRole: string | null;
    highlightWordCount: number;
    schema: Record<string, unknown>;
    temperature: number;
    contextBefore: string;
    contextAfter: string;
    fullPrompt: string;
    originalUserPrompt: string;
    brainstormContext: BrainstormContext | null;
    editHistory: Array<{ original?: string; category?: string }>;
    modelTarget: string | null;
    promptSection: string | null;
  }): Promise<{
    suggestionsToUse: Suggestion[];
    activeConstraints: VideoConstraints | undefined;
    alignmentFallbackApplied: boolean;
    usedFallback: boolean;
    fallbackSourceCount: number;
  }> {
    const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(params.suggestions);

    const alignmentResult = this._applyCategoryAlignment(
      diverseSuggestions,
      params.highlightedCategory,
      params.highlightedText,
      params.highlightedCategoryConfidence ?? null
    );

    const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
      alignmentResult.suggestions,
      {
        highlightedText: params.highlightedText,
        isPlaceholder: params.isPlaceholder,
        isVideoPrompt: params.isVideoPrompt,
        ...(params.videoConstraints ? { videoConstraints: params.videoConstraints } : {}),
      }
    );

    const fallbackParams: {
      sanitizedSuggestions: Suggestion[];
      isVideoPrompt: boolean;
      isPlaceholder: boolean;
      videoConstraints?: VideoConstraints;
      regenerationDetails: {
        highlightWordCount?: number;
        phraseRole?: string;
        highlightedText?: string;
        highlightedCategory?: string;
        highlightedCategoryConfidence?: number;
      };
      requestParams: PromptBuildParams;
      aiService: AIService;
      schema: Record<string, unknown>;
      temperature: number;
    } = {
      sanitizedSuggestions,
      isVideoPrompt: params.isVideoPrompt,
      isPlaceholder: params.isPlaceholder,
      regenerationDetails: {
        highlightWordCount: params.highlightWordCount,
      },
      requestParams: {
        highlightedText: params.highlightedText,
        contextBefore: params.contextBefore,
        contextAfter: params.contextAfter,
        fullPrompt: params.fullPrompt,
        originalUserPrompt: params.originalUserPrompt,
        isVideoPrompt: params.isVideoPrompt,
        isPlaceholder: params.isPlaceholder,
        brainstormContext: params.brainstormContext,
        phraseRole: params.phraseRole,
        highlightWordCount: params.highlightWordCount,
        highlightedCategory: params.highlightedCategory,
        highlightedCategoryConfidence: params.highlightedCategoryConfidence ?? null,
        editHistory: params.editHistory,
        modelTarget: params.modelTarget,
        promptSection: params.promptSection,
      },
      aiService: this.ai,
      schema: params.schema,
      temperature: params.temperature,
    };
    if (params.videoConstraints) fallbackParams.videoConstraints = params.videoConstraints;
    if (params.phraseRole) fallbackParams.regenerationDetails.phraseRole = params.phraseRole;
    if (params.highlightedText) fallbackParams.regenerationDetails.highlightedText = params.highlightedText;
    if (params.highlightedCategory) fallbackParams.regenerationDetails.highlightedCategory = params.highlightedCategory;
    if (params.highlightedCategoryConfidence !== null && params.highlightedCategoryConfidence !== undefined) {
      fallbackParams.regenerationDetails.highlightedCategoryConfidence = params.highlightedCategoryConfidence;
    }
    
    const fallbackResult = await this.fallbackRegeneration.attemptFallbackRegeneration(fallbackParams);

    let suggestionsToUse = fallbackResult.suggestions;
    const activeConstraints = fallbackResult.constraints;
    let usedFallback = fallbackResult.usedFallback;
    const fallbackSourceCount = fallbackResult.sourceCount;

    if (suggestionsToUse.length === 0) {
      const descriptorResult = this.suggestionProcessor.applyDescriptorFallbacks(
        suggestionsToUse,
        params.highlightedText
      );
      suggestionsToUse = descriptorResult.suggestions;
      if (descriptorResult.usedFallback) {
        usedFallback = true;
      }
    }

    logger.info('Processing suggestions for categorization', {
      isPlaceholder: params.isPlaceholder,
      hasCategoryField: suggestionsToUse[0]?.category !== undefined,
      totalSuggestions: suggestionsToUse.length,
      sanitizedCount: sanitizedSuggestions.length,
      appliedConstraintMode: activeConstraints?.mode || null,
      usedFallback,
    });

    return {
      suggestionsToUse,
      activeConstraints,
      alignmentFallbackApplied: alignmentResult.fallbackApplied,
      usedFallback,
      fallbackSourceCount,
    };
  }

  /**
   * Build final enhancement result from processed suggestions
   * @private
   */
  private _buildEnhancementResult(params: {
    suggestionsToUse: Suggestion[];
    activeConstraints: VideoConstraints | undefined;
    alignmentFallbackApplied: boolean;
    usedFallback: boolean;
    isPlaceholder: boolean;
    phraseRole: string | null;
  }): EnhancementResult {
    const groupedSuggestions = this.suggestionProcessor.groupSuggestions(
      params.suggestionsToUse,
      params.isPlaceholder
    );

    const buildResultParams: {
      groupedSuggestions: Suggestion[] | GroupedSuggestions[];
      isPlaceholder: boolean;
      phraseRole?: string | null;
      activeConstraints?: { mode?: string } | null;
      alignmentFallbackApplied?: boolean;
      usedFallback?: boolean;
      hasNoSuggestions?: boolean;
    } = {
      groupedSuggestions,
      isPlaceholder: params.isPlaceholder,
    };
    if (params.phraseRole !== null) buildResultParams.phraseRole = params.phraseRole;
    if (params.activeConstraints && params.activeConstraints.mode) {
      buildResultParams.activeConstraints = { mode: params.activeConstraints.mode };
    } else if (params.activeConstraints) {
      buildResultParams.activeConstraints = null;
    }
    if (params.alignmentFallbackApplied) buildResultParams.alignmentFallbackApplied = true;
    if (params.usedFallback) buildResultParams.usedFallback = true;
    if (params.suggestionsToUse.length === 0) buildResultParams.hasNoSuggestions = true;
    
    return this.suggestionProcessor.buildResult(buildResultParams);
  }

  /**
   * Generate cache key for enhancement request
   * Includes edit/model context for cache separation
   * @private
   */
  private _generateCacheKey(params: {
    highlightedText: string;
    contextBefore: string;
    contextAfter: string;
    fullPrompt: string;
    originalUserPrompt: string;
    isVideoPrompt: boolean;
    brainstormSignature: string;
    highlightedCategory: string | null;
    highlightWordCount: number;
    phraseRole: string | null;
    videoConstraints: VideoConstraints | null;
    editHistory: Array<{ original?: string; category?: string }>;
    modelTarget: string | null;
    promptSection: string | null;
  }): string {
    let editFingerprint: string | null = null;
    if (Array.isArray(params.editHistory) && params.editHistory.length > 0) {
      // Create compact fingerprint from recent edit patterns
      editFingerprint = params.editHistory
        .slice(-5) // Last 5 edits only
        .map((edit) => `${edit.category || 'n'}:${(edit.original || '').substring(0, 10)}`)
        .join('|');
    }

    return cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText: params.highlightedText,
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      fullPrompt: (params.fullPrompt || '').substring(0, 500),
      originalUserPrompt: (params.originalUserPrompt || '').substring(0, 500),
      isVideoPrompt: params.isVideoPrompt,
      brainstormSignature: params.brainstormSignature,
      highlightedCategory: params.highlightedCategory || null,
      highlightWordCount: params.highlightWordCount,
      phraseRole: params.phraseRole,
      videoConstraintMode: params.videoConstraints?.mode || null,
      editFingerprint: editFingerprint || null,
      modelTarget: params.modelTarget || null,
      promptSection: params.promptSection || null,
    });
  }

  /**
   * Apply category alignment if needed
   * @private
   */
  private _applyCategoryAlignment(
    suggestions: Suggestion[],
    highlightedCategory: string | null,
    highlightedText: string,
    confidence: number | null
  ): CategoryAlignmentResult {
    if (!highlightedCategory) {
      return { suggestions, fallbackApplied: false, context: {} };
    }

    const alignmentResult = this.categoryAligner.enforceCategoryAlignment(suggestions, {
      highlightedText,
      highlightedCategory,
      ...(confidence !== null && confidence !== undefined ? { highlightedCategoryConfidence: confidence } : {}),
    });

    if (alignmentResult.fallbackApplied) {
      logger.info('Applied category fallbacks', {
        highlightedText,
        category: highlightedCategory,
        reason: alignmentResult.context.reason,
      });
    }

    return alignmentResult;
  }

}

