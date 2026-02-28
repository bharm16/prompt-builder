import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import type { CacheService } from '@services/cache/CacheService';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { getEnhancementSchema, getCustomSuggestionSchema } from './config/schemas';
import { FallbackRegenerationService } from './services/FallbackRegenerationService';
import { StyleTransferService } from './services/StyleTransferService';
import { ContrastiveDiversityEnforcer } from './services/ContrastiveDiversityEnforcer';
import { EnhancementMetricsService } from './services/EnhancementMetricsService';
import { VideoContextDetectionService } from './services/VideoContextDetectionService';
import { SuggestionGenerationService } from './services/SuggestionGenerationService';
import { SuggestionProcessingService } from './services/SuggestionProcessingService';
import { I2VConstrainedSuggestions } from './services/I2VConstrainedSuggestions';
import { detectPlaceholder } from './services/placeholderDetection';
import { CacheKeyFactory } from './utils/CacheKeyFactory';
import { PROMPT_MODES } from './constants';
import { getParentCategory } from '@shared/taxonomy';
import { hashString } from '@utils/hash';
import type {
  AIService,
  VideoService,
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
  PromptBuildParams,
  GroupedSuggestions,
  OutputSchema,
  LabeledSpan,
  NearbySpan,
} from './services/types';

interface EnhancementServiceDependencies {
  aiService: AIService;
  videoService: VideoService;
  brainstormBuilder: BrainstormBuilder;
  promptBuilder: PromptBuilder;
  validationService: ValidationService;
  diversityEnforcer: DiversityEnforcer;
  categoryAligner: CategoryAligner;
  metricsService?: MetricsService | null;
  cacheService: CacheService;
}

interface EnhancementCoreServices {
  ai: AIService;
  videoService: VideoService;
  brainstormBuilder: BrainstormBuilder;
  promptBuilder: PromptBuilder;
  validationService: ValidationService;
  diversityEnforcer: DiversityEnforcer;
  categoryAligner: CategoryAligner;
  metricsService: MetricsService | null;
}

interface EnhancementPipelineServices {
  fallbackRegeneration: FallbackRegenerationService;
  styleTransfer: StyleTransferService;
  contrastiveDiversity: ContrastiveDiversityEnforcer;
  metricsLogger: EnhancementMetricsService;
  videoContextDetection: VideoContextDetectionService;
  suggestionGeneration: SuggestionGenerationService;
  suggestionProcessing: SuggestionProcessingService;
}

/**
 * EnhancementService - Main Orchestrator
 *
 * Coordinates enhancement suggestion generation by delegating to specialized services.
 * This service focuses purely on orchestration.
 *
 * Single Responsibility: Orchestrate the enhancement suggestion workflow
 */
export class EnhancementService {
  private readonly core: EnhancementCoreServices;
  private readonly pipeline: EnhancementPipelineServices;
  private readonly cacheConfig: { ttl: number; namespace: string };
  private readonly log: ILogger;
  private readonly i2vConstraints: I2VConstrainedSuggestions;
  private readonly cacheService: CacheService;

  constructor(dependencies: EnhancementServiceDependencies) {
    const {
      aiService,
      videoService,
      brainstormBuilder,
      promptBuilder,
      validationService,
      diversityEnforcer,
      categoryAligner,
      metricsService = null,
      cacheService,
    } = dependencies;

    this.core = {
      ai: aiService,
      videoService,
      brainstormBuilder,
      promptBuilder,
      validationService,
      diversityEnforcer,
      categoryAligner,
      metricsService,
    };

    this.log = logger.child({ service: 'EnhancementService' });
    this.cacheService = cacheService;
    this.cacheConfig = this.cacheService.getConfig('enhancement') || {
      ttl: 3600,
      namespace: 'enhancement',
    };

    // Initialize specialized services
    const contrastiveDiversity = new ContrastiveDiversityEnforcer(aiService);
    const fallbackRegeneration = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer
    );
    const suggestionProcessing = new SuggestionProcessingService(
      diversityEnforcer,
      validationService,
      categoryAligner,
      fallbackRegeneration,
      aiService
    );

    this.pipeline = {
      fallbackRegeneration,
      styleTransfer: new StyleTransferService(aiService),
      contrastiveDiversity,
      metricsLogger: new EnhancementMetricsService(metricsService),
      videoContextDetection: new VideoContextDetectionService(videoService),
      suggestionGeneration: new SuggestionGenerationService(
        aiService,
        contrastiveDiversity
      ),
      suggestionProcessing,
    };
    this.i2vConstraints = new I2VConstrainedSuggestions();
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
    i2vContext = null,
    debug = false,
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

      const videoContext = this.pipeline.videoContextDetection.detectVideoContext({
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
      const brainstormSignature = this.core.brainstormBuilder.buildBrainstormSignature(brainstormContext ?? null);
      const highlightWordCount = videoContext.highlightWordCount;
      const phraseRole = videoContext.phraseRole;
      const videoConstraints = videoContext.videoConstraints;
      const spanContext = this._buildSpanContext({
        allLabeledSpans,
        nearbySpans,
        fullPrompt,
        highlightedText,
        highlightedCategory: highlightedCategory ?? null,
        phraseRole,
      });
      const focusGuidance = this.core.videoService.getCategoryFocusGuidance(
        phraseRole,
        highlightedCategory ?? null,
        fullPrompt,
        spanContext.guidanceSpans,
        editHistory
      ) || undefined;

      if (i2vContext && highlightedCategory) {
        const prefilter = this.i2vConstraints.filterSuggestions(
          [],
          highlightedCategory,
          i2vContext.lockMap,
          i2vContext.observation
        );

        if (prefilter.blockedReason) {
          const isPlaceholder = detectPlaceholder(
            highlightedText,
            contextBefore,
            contextAfter,
            fullPrompt
          );
          return {
            suggestions: [],
            isPlaceholder,
            hasCategories: true,
            phraseRole: null,
            appliedConstraintMode: null,
            fallbackApplied: false,
            metadata: {
              i2v: {
                locked: true,
                reason: prefilter.blockedReason,
                motionAlternatives: prefilter.motionAlternatives ?? [],
              },
            },
          };
        }
      }

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
      }, this.cacheService);

      const cached = await this.cacheService.get<EnhancementResult>(cacheKey, 'enhancement');
      metrics.cacheCheck = Date.now() - cacheStart;

      if (cached && !debug) {
        metrics.cache = true;
        metrics.total = Date.now() - startTotal;
        metrics.promptMode = PROMPT_MODES.ENHANCEMENT;
        this.pipeline.metricsLogger.logMetrics(metrics, {
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

      if (cached && debug) {
        this.log.debug('Bypassing cache for debug request.', {
          operation,
          cacheCheckTime: metrics.cacheCheck,
        });
      }

      const isPlaceholder = detectPlaceholder(
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt
      );

      const promptBuildStart = Date.now();
      const promptBuilderInput: PromptBuildParams = {
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
        ...(spanContext.spanAnchors ? { spanAnchors: spanContext.spanAnchors } : {}),
        ...(spanContext.nearbySpanHints ? { nearbySpanHints: spanContext.nearbySpanHints } : {}),
        ...(focusGuidance !== undefined ? { focusGuidance } : {}),
      };
      if (highlightedCategoryConfidence !== null && highlightedCategoryConfidence !== undefined) {
        promptBuilderInput.highlightedCategoryConfidence = highlightedCategoryConfidence;
      }
      const promptResult = isPlaceholder
        ? this.core.promptBuilder.buildPlaceholderPrompt(promptBuilderInput)
        : this.core.promptBuilder.buildRewritePrompt(promptBuilderInput);
      metrics.promptBuild = Date.now() - promptBuildStart;

      const schema = getEnhancementSchema(isPlaceholder);
      const temperature = this._getEnhancementTemperature();

      const generationResult = await this.pipeline.suggestionGeneration.generateSuggestionsV2({
        promptResult,
        schema: schema as OutputSchema,
        isVideoPrompt,
        isPlaceholder,
        highlightedText,
        temperature,
        metrics,
      });
      
      const suggestions = generationResult.suggestions;
      const rawSuggestionsSnapshot = Array.isArray(suggestions)
        ? suggestions.map((suggestion) => ({ ...suggestion }))
        : [];
      metrics.groqCall = generationResult.groqCallTime;
      metrics.usedContrastiveDecoding = generationResult.usedContrastiveDecoding;

      const postStart = Date.now();
      const suggestionProcessingParams = {
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
        ...(spanContext.spanAnchors ? { spanAnchors: spanContext.spanAnchors } : {}),
        ...(spanContext.nearbySpanHints ? { nearbySpanHints: spanContext.nearbySpanHints } : {}),
        ...(focusGuidance !== undefined ? { focusGuidance } : {}),
        ...(spanContext.lockedSpanCategories.length > 0
          ? { lockedSpanCategories: spanContext.lockedSpanCategories }
          : {}),
        skipDiversityCheck: generationResult.usedContrastiveDecoding,
      };
      const processingResult =
        await this.pipeline.suggestionProcessing.processSuggestions(suggestionProcessingParams);

      const result = this._buildEnhancementResult({
        suggestionsToUse: processingResult.suggestionsToUse,
        activeConstraints: processingResult.activeConstraints,
        alignmentFallbackApplied: processingResult.alignmentFallbackApplied,
        usedFallback: processingResult.usedFallback,
        isPlaceholder,
        phraseRole,
      });

      if (i2vContext && highlightedCategory) {
        const hasGroupedSuggestions =
          Array.isArray(result.suggestions) &&
          result.suggestions.length > 0 &&
          'suggestions' in result.suggestions[0]!;
        if (!hasGroupedSuggestions) {
          const filtered = this.i2vConstraints.filterSuggestions(
            result.suggestions as Suggestion[],
            highlightedCategory,
            i2vContext.lockMap,
            i2vContext.observation
          );

          result.suggestions = filtered.suggestions;
          if (filtered.blockedReason || filtered.motionAlternatives) {
            result.metadata = {
              ...(result.metadata || {}),
              i2v: {
                locked: !!filtered.blockedReason,
                reason: filtered.blockedReason,
                motionAlternatives: filtered.motionAlternatives ?? [],
              },
            };
          }
        }
      }

      metrics.postProcessing = Date.now() - postStart;

      // Note: sanitizedSuggestions not available here after extraction, using suggestionsToUse instead
      this.pipeline.suggestionProcessing.logResult(
        result,
        processingResult.suggestionsToUse,
        processingResult.usedFallback,
        processingResult.fallbackSourceCount,
        suggestions ?? []
      );

      await this.cacheService.set(cacheKey, result, {
        ttl: this.cacheConfig.ttl,
      });

      metrics.total = Date.now() - startTotal;
      metrics.promptMode = PROMPT_MODES.ENHANCEMENT;
      this.pipeline.metricsLogger.logMetrics(metrics, {
        highlightedCategory: highlightedCategory ?? null,
        isVideoPrompt,
        modelTarget,
        promptSection,
      });
      this.pipeline.metricsLogger.checkLatency(metrics);

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

      if (debug && process.env.NODE_ENV !== 'production') {
        const systemPromptSent =
          typeof promptResult === 'string'
            ? promptResult
            : ((promptResult as { systemPrompt?: string }).systemPrompt ?? '');
        result._debug = {
          fullPrompt,
          selectedSpan: highlightedText,
          category: highlightedCategory ?? null,
          categoryConfidence: highlightedCategoryConfidence ?? null,
          systemPromptSent,
          // Design/slot are currently resolved inside private prompt builder internals.
          design: '',
          slot: '',
          isVideoPrompt,
          isPlaceholder,
          modelTarget,
          promptSection,
          phraseRole,
          rawAiSuggestions: rawSuggestionsSnapshot,
          finalSuggestions: processingResult.suggestionsToUse.map((suggestion) => ({ ...suggestion })),
          processingNotes: {
            contrastiveDecoding: generationResult.usedContrastiveDecoding,
            diversityEnforced:
              processingResult.suggestionsToUse.length !== rawSuggestionsSnapshot.length,
            alignmentFallback: processingResult.alignmentFallbackApplied,
            usedFallback: processingResult.usedFallback,
            fallbackSourceCount: processingResult.fallbackSourceCount,
          },
          spanContext: {
            spanAnchors: spanContext.spanAnchors ?? '',
            nearbySpanHints: spanContext.nearbySpanHints ?? '',
          },
          videoConstraints: videoConstraints ?? null,
          temperature,
          metrics: { ...metrics },
        };
      }

      return result;
    } catch (error) {
      metrics.total = Date.now() - startTotal;
      metrics.promptMode = PROMPT_MODES.ENHANCEMENT;
      this.pipeline.metricsLogger.logMetrics(
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
    const cacheKey = this.cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText,
      customRequest,
      fullPrompt: fullPrompt.substring(0, 500),
      contextBefore: contextBefore?.substring(0, 200),
      contextAfter: contextAfter?.substring(0, 200),
      spanId: (metadata as { spanId?: string } | null)?.spanId
        ?? (metadata as { span?: { id?: string } } | null)?.span?.id
        ?? null,
    });

    const cached = await this.cacheService.get<{ suggestions: Suggestion[] }>(cacheKey, 'enhancement');
    if (cached) {
      this.log.debug('Cache hit for custom suggestions', {
        operation,
        duration: Math.round(performance.now() - startTime),
        suggestionCount: cached.suggestions?.length || 0,
      });
      return cached;
    }

    // Detect video prompt
    const isVideoPrompt = this.core.videoService.isVideoPrompt(fullPrompt);

    // Build prompt
    const customPromptParams = {
      highlightedText,
      customRequest,
      fullPrompt,
      isVideoPrompt,
      ...(contextBefore !== undefined ? { contextBefore } : {}),
      ...(contextAfter !== undefined ? { contextAfter } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    };
    const systemPrompt = this.core.promptBuilder.buildCustomPrompt(customPromptParams);

    // Generate suggestions
    const schema = getCustomSuggestionSchema({ operation: 'custom_suggestions' });
    const temperature = this._getEnhancementTemperature();

    const suggestions = await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
      this.core.ai,
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
    const diverseSuggestions = await this.core.diversityEnforcer.ensureDiverseSuggestions(suggestions);

    const result = { suggestions: diverseSuggestions };

    // Cache result
    await this.cacheService.set(cacheKey, result, {
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
    return this.pipeline.styleTransfer.transferStyle(text, targetStyle);
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
    const groupedSuggestions = this.pipeline.suggestionProcessing.groupSuggestions(
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
    
    return this.pipeline.suggestionProcessing.buildResult(buildResultParams);
  }

  private _buildSpanContext({
    allLabeledSpans,
    nearbySpans,
    fullPrompt,
    highlightedText,
    highlightedCategory,
    phraseRole,
  }: {
    allLabeledSpans: LabeledSpan[];
    nearbySpans: NearbySpan[];
    fullPrompt: string;
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
        start: typeof span.start === 'number' ? span.start : undefined,
        end: typeof span.end === 'number' ? span.end : undefined,
      }))
      .filter((span) => span.text && span.text.toLowerCase() !== normalizedHighlight);

    const clauses = this._findClauseBoundaries(fullPrompt);
    const highlightRange = this._resolveSpanRange(fullPrompt, highlightedText);
    const highlightClauseIndex = this._findClauseIndex(clauses, highlightRange);

    const sameClauseAnchors = new Map<string, { text: string; confidence: number }>();
    const promptWideAnchors = new Map<string, { text: string; confidence: number }>();
    for (const span of anchorCandidates) {
      const parent = getParentCategory(span.category) || span.category;
      if (!parent) continue;
      if (highlightParent && parent === highlightParent) continue;

      const spanRange = this._resolveSpanRange(fullPrompt, span.text, span.start, span.end);
      const spanClauseIndex = this._findClauseIndex(clauses, spanRange);
      const anchorPool =
        highlightClauseIndex !== null && spanClauseIndex === highlightClauseIndex
          ? sameClauseAnchors
          : promptWideAnchors;

      const existing = anchorPool.get(parent);
      if (!existing || span.confidence > existing.confidence) {
        anchorPool.set(parent, { text: span.text, confidence: span.confidence });
      }
    }

    const anchorByCategory = new Map<string, { text: string; confidence: number }>(
      sameClauseAnchors
    );
    for (const [category, anchor] of promptWideAnchors.entries()) {
      if (!anchorByCategory.has(category)) {
        anchorByCategory.set(category, anchor);
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

  private _findClauseBoundaries(fullPrompt: string): Array<{ start: number; end: number }> {
    if (typeof fullPrompt !== 'string' || !fullPrompt.trim()) {
      return [];
    }

    const clauseRanges: Array<{ start: number; end: number }> = [];
    const delimiterPattern = /[.;]|\bwhile\b|\bas\b|\band\b/gi;
    let clauseStart = 0;
    let match: RegExpExecArray | null;

    while ((match = delimiterPattern.exec(fullPrompt)) !== null) {
      const clauseEnd = match.index;
      const trimmed = this._trimRange(fullPrompt, clauseStart, clauseEnd - 1);
      if (trimmed) {
        clauseRanges.push(trimmed);
      }
      clauseStart = match.index + match[0].length;
    }

    const trailingClause = this._trimRange(
      fullPrompt,
      clauseStart,
      fullPrompt.length - 1
    );
    if (trailingClause) {
      clauseRanges.push(trailingClause);
    }

    if (clauseRanges.length === 0) {
      const wholeRange = this._trimRange(fullPrompt, 0, fullPrompt.length - 1);
      return wholeRange ? [wholeRange] : [];
    }

    return clauseRanges;
  }

  private _trimRange(
    text: string,
    start: number,
    end: number
  ): { start: number; end: number } | null {
    let trimmedStart = Math.max(0, start);
    let trimmedEnd = Math.min(text.length - 1, end);

    while (trimmedStart <= trimmedEnd && /\s/.test(text[trimmedStart] || '')) {
      trimmedStart += 1;
    }
    while (trimmedEnd >= trimmedStart && /\s/.test(text[trimmedEnd] || '')) {
      trimmedEnd -= 1;
    }

    return trimmedStart <= trimmedEnd ? { start: trimmedStart, end: trimmedEnd } : null;
  }

  private _resolveSpanRange(
    fullPrompt: string,
    spanText: string,
    start?: number,
    end?: number
  ): { start: number; end: number } | null {
    if (Number.isFinite(start) && Number.isFinite(end) && (end as number) > (start as number)) {
      const boundedStart = Math.max(0, start as number);
      const boundedEnd = Math.min(fullPrompt.length - 1, (end as number) - 1);
      return boundedStart <= boundedEnd
        ? { start: boundedStart, end: boundedEnd }
        : null;
    }

    const normalizedText = spanText.trim().toLowerCase();
    if (!normalizedText) return null;
    const index = fullPrompt.toLowerCase().indexOf(normalizedText);
    if (index < 0) return null;
    return { start: index, end: index + normalizedText.length - 1 };
  }

  private _findClauseIndex(
    clauses: Array<{ start: number; end: number }>,
    spanRange: { start: number; end: number } | null
  ): number | null {
    if (!spanRange || clauses.length === 0) {
      return null;
    }

    for (let i = 0; i < clauses.length; i += 1) {
      const clause = clauses[i];
      if (!clause) continue;
      if (spanRange.start >= clause.start && spanRange.start <= clause.end) {
        return i;
      }
    }

    return null;
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
    const config = this.core.ai.getOperationConfig('enhance_suggestions');
    if (typeof config?.temperature === 'number') {
      return config.temperature;
    }
    return TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
    });
  }


}
