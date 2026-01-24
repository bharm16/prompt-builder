import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { cacheService } from '@services/cache/CacheService';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { getEnhancementSchema, getCustomSuggestionSchema } from './config/schemas';
import { FallbackRegenerationService } from './services/FallbackRegenerationService';
import { SuggestionProcessor } from './services/SuggestionProcessor';
import { StyleTransferService } from './services/StyleTransferService';
import { ContrastiveDiversityEnforcer } from './services/ContrastiveDiversityEnforcer';
import { EnhancementMetricsService } from './services/EnhancementMetricsService';
import { VideoContextDetectionService } from './services/VideoContextDetectionService';
import { SuggestionGenerationService } from './services/SuggestionGenerationService';
import { SuggestionProcessingService } from './services/SuggestionProcessingService';
import { CacheKeyFactory } from './utils/CacheKeyFactory';
import { PROMPT_MODES } from './constants';
import { getParentCategory } from '@shared/taxonomy';
import { hashString } from '@utils/hash';
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
  OutputSchema,
  LabeledSpan,
  NearbySpan,
} from './services/types';

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
  private readonly videoContextDetection: VideoContextDetectionService;
  private readonly suggestionGeneration: SuggestionGenerationService;
  private readonly suggestionProcessing: SuggestionProcessingService;
  private readonly log: ILogger;

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
    this.log = logger.child({ service: 'EnhancementService' });
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
    this.videoContextDetection = new VideoContextDetectionService(videoService);
    this.suggestionGeneration = new SuggestionGenerationService(
      aiService,
      this.contrastiveDiversity
    );
    this.suggestionProcessing = new SuggestionProcessingService(
      diversityEnforcer,
      validationService,
      categoryAligner,
      this.fallbackRegeneration,
      this.suggestionProcessor,
      aiService
    );
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
    allLabeledSpans = [],
    nearbySpans = [],
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

    const operation = 'getEnhancementSuggestions';
    
    try {
      this.log.debug('Starting operation.', {
        operation,
        highlightedLength: highlightedText?.length,
        highlightedCategory: highlightedCategory || null,
        categoryConfidence: highlightedCategoryConfidence ?? null,
        hasBrainstormContext: !!brainstormContext,
        editHistoryLength: editHistory?.length || 0,
      });

      const videoContext = this.videoContextDetection.detectVideoContext({
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
      const spanContext = this._buildSpanContext({
        allLabeledSpans,
        nearbySpans,
        highlightedText,
        highlightedCategory: highlightedCategory ?? null,
        phraseRole,
      });
      const focusGuidance = this.videoService.getCategoryFocusGuidance(
        phraseRole,
        highlightedCategory ?? null,
        fullPrompt,
        spanContext.guidanceSpans,
        editHistory
      ) || undefined;

      const cacheStart = Date.now();
      const cacheKey = CacheKeyFactory.generateKey(this.cacheConfig.namespace, {
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
        spanFingerprint: spanContext.spanFingerprint,
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
        this.log.debug('Cache hit for enhancement suggestions', {
          operation,
          cacheCheckTime: metrics.cacheCheck,
          totalTime: metrics.total,
          promptMode: metrics.promptMode,
          suggestionCount: this._countSuggestions(cached.suggestions),
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
        spanAnchors: spanContext.spanAnchors,
        nearbySpanHints: spanContext.nearbySpanHints,
        focusGuidance,
      };
      const promptResult = isPlaceholder
        ? this.promptBuilder.buildPlaceholderPrompt(promptBuilderInput)
        : this.promptBuilder.buildRewritePrompt(promptBuilderInput);
      metrics.promptBuild = Date.now() - promptBuildStart;

      const schema = getEnhancementSchema(isPlaceholder);
      const temperature = this._getEnhancementTemperature();

      const generationResult = await this.suggestionGeneration.generateSuggestionsV2({
        promptResult,
        schema: schema as OutputSchema,
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
      const processingResult = await this.suggestionProcessing.processSuggestions({
        suggestions: suggestions ?? [],
        highlightedCategory: highlightedCategory ?? null,
        highlightedText,
        highlightedCategoryConfidence: highlightedCategoryConfidence ?? null,
        isPlaceholder,
        isVideoPrompt,
        videoConstraints,
        phraseRole,
        highlightWordCount,
        schema: schema as OutputSchema,
        temperature,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        brainstormContext: brainstormContext ?? null,
        editHistory,
        modelTarget,
        promptSection,
        spanAnchors: spanContext.spanAnchors,
        nearbySpanHints: spanContext.nearbySpanHints,
        focusGuidance,
        lockedSpanCategories: spanContext.lockedSpanCategories,
        skipDiversityCheck: generationResult.usedContrastiveDecoding,
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

      this.log.info('Operation completed.', {
        operation,
        duration: metrics.total,
        suggestionCount: this._countSuggestions(result.suggestions),
        fromCache: metrics.cache,
        isVideoPrompt,
        isPlaceholder,
        modelTarget,
        promptSection,
      });

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
      
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: metrics.total,
        highlightedCategory: highlightedCategory ?? null,
        isVideoPrompt,
      });
      throw error;
    }
  }

  /**
   * Get custom suggestions based on user request
   */
  async getCustomSuggestions({ 
    highlightedText, 
    customRequest, 
    fullPrompt,
    contextBefore,
    contextAfter,
    metadata,
  }: CustomSuggestionRequestParams): Promise<{ suggestions: Suggestion[] }> {
    const startTime = performance.now();
    const operation = 'getCustomSuggestions';
    
    this.log.debug('Starting operation.', {
      operation,
      customRequestLength: customRequest?.length || 0,
      highlightedLength: highlightedText?.length,
      hasContextBefore: Boolean(contextBefore?.trim()),
      hasContextAfter: Boolean(contextAfter?.trim()),
      hasMetadata: Boolean(metadata && Object.keys(metadata).length > 0),
    });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText,
      customRequest,
      fullPrompt: fullPrompt.substring(0, 500),
      contextBefore: contextBefore?.substring(0, 200),
      contextAfter: contextAfter?.substring(0, 200),
      spanId: (metadata as { spanId?: string } | null)?.spanId
        ?? (metadata as { span?: { id?: string } } | null)?.span?.id
        ?? null,
    });

    const cached = await cacheService.get<{ suggestions: Suggestion[] }>(cacheKey, 'enhancement');
    if (cached) {
      this.log.debug('Cache hit for custom suggestions', {
        operation,
        duration: Math.round(performance.now() - startTime),
        suggestionCount: cached.suggestions?.length || 0,
      });
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
      contextBefore,
      contextAfter,
      metadata,
    });

    // Generate suggestions
    const schema = getCustomSuggestionSchema({ operation: 'custom_suggestions' });
    const temperature = this._getEnhancementTemperature();

    const suggestions = await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
      this.ai,
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

    this.log.info('Operation completed.', {
      operation,
      duration: Math.round(performance.now() - startTime),
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

  private _buildSpanContext({
    allLabeledSpans,
    nearbySpans,
    highlightedText,
    highlightedCategory,
    phraseRole,
  }: {
    allLabeledSpans: LabeledSpan[];
    nearbySpans: NearbySpan[];
    highlightedText: string;
    highlightedCategory: string | null;
    phraseRole: string | null;
  }): {
    spanAnchors: string;
    nearbySpanHints: string;
    spanFingerprint: string | null;
    lockedSpanCategories: string[];
    guidanceSpans: Array<{ category?: string; text?: string }>;
  } {
    const normalizedHighlight = highlightedText.trim().toLowerCase();
    const highlightParent =
      getParentCategory(highlightedCategory) ||
      getParentCategory(phraseRole) ||
      null;

    const guidanceSpans = (allLabeledSpans || [])
      .map((span) => ({
        category: span.category || span.role,
        text: span.text,
      }))
      .filter((span) => span.text && span.text.trim());

    const anchorCandidates = (allLabeledSpans || [])
      .map((span) => ({
        text: (span.text || '').replace(/\s+/g, ' ').trim(),
        category: span.category || span.role || 'unknown',
        confidence: typeof span.confidence === 'number' ? span.confidence : 0,
      }))
      .filter((span) => span.text && span.text.toLowerCase() !== normalizedHighlight);

    const anchorByCategory = new Map<string, { text: string; confidence: number }>();
    for (const span of anchorCandidates) {
      const parent = getParentCategory(span.category) || span.category;
      if (!parent) continue;
      if (highlightParent && parent === highlightParent) continue;
      const existing = anchorByCategory.get(parent);
      if (!existing || span.confidence > existing.confidence) {
        anchorByCategory.set(parent, { text: span.text, confidence: span.confidence });
      }
    }

    const anchorLines = Array.from(anchorByCategory.entries())
      .sort(([, a], [, b]) => b.confidence - a.confidence)
      .slice(0, 4)
      .map(([category, span]) => `- ${category}: "${span.text.replace(/"/g, "'")}"`);

    const nearbyCandidates = (nearbySpans || [])
      .map((span) => ({
        text: (span.text || '').replace(/\s+/g, ' ').trim(),
        category: span.category || span.role || 'unknown',
        distance: typeof span.distance === 'number' ? span.distance : Number.MAX_SAFE_INTEGER,
      }))
      .filter((span) => span.text && span.text.toLowerCase() !== normalizedHighlight)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    const nearbyLines = nearbyCandidates.map(
      (span) => `- ${getParentCategory(span.category) || span.category}: "${span.text.replace(/"/g, "'")}"`
    );

    const lockedSpanCategories = Array.from(
      new Set(
        nearbyCandidates
          .map((span) => getParentCategory(span.category) || span.category)
          .filter((value): value is string => Boolean(value))
      )
    );

    const fingerprintSeed = [...anchorLines, ...nearbyLines]
      .map((line) => line.replace(/^-\s*/, ''))
      .join('|');
    const spanFingerprint = fingerprintSeed
      ? hashString(fingerprintSeed).toString(36)
      : null;

    return {
      spanAnchors: anchorLines.join('\n'),
      nearbySpanHints: nearbyLines.join('\n'),
      spanFingerprint,
      lockedSpanCategories,
      guidanceSpans,
    };
  }

  private _countSuggestions(suggestions: EnhancementResult['suggestions'] | undefined): number {
    if (!Array.isArray(suggestions)) return 0;
    const first = suggestions[0] as { suggestions?: unknown } | undefined;
    if (first && Array.isArray(first.suggestions)) {
      return suggestions.reduce((sum, group) => {
        const groupSuggestions = (group as { suggestions?: unknown }).suggestions;
        return sum + (Array.isArray(groupSuggestions) ? groupSuggestions.length : 0);
      }, 0);
    }
    return suggestions.length;
  }

  private _getEnhancementTemperature(): number {
    const config = this.ai.getOperationConfig('enhance_suggestions');
    if (typeof config?.temperature === 'number') {
      return config.temperature;
    }
    return TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
    });
  }


}
