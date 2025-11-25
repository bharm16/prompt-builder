import { logger } from '@infrastructure/Logger.ts';
import { cacheService } from '../cache/CacheService.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer.js';
import { getEnhancementSchema, getCustomSuggestionSchema } from './config/schemas.js';
import { FallbackRegenerationService } from './services/FallbackRegenerationService.js';
import { SuggestionProcessor } from './services/SuggestionProcessor.js';
import { StyleTransferService } from './services/StyleTransferService.js';
import { ContrastiveDiversityEnforcer } from './services/ContrastiveDiversityEnforcer.js';

/**
 * EnhancementService - Main Orchestrator
 *
 * Coordinates enhancement suggestion generation by delegating to specialized services.
 * This service focuses purely on orchestration.
 *
 * Single Responsibility: Orchestrate the enhancement suggestion workflow
 */
export class EnhancementService {
  constructor(
    aiService,
    placeholderDetector,
    videoService,
    brainstormBuilder,
    promptBuilder,
    validationService,
    diversityEnforcer,
    categoryAligner,
    metricsService = null
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
  }

  /**
   * Get enhancement suggestions for highlighted text
   * @param {Object} params - Enhancement parameters
   * @returns {Promise<Object>} Suggestions with metadata
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
    editHistory = [], // NEW: Edit history for consistency
  }) {
    const metrics = {
      total: 0,
      cache: false,
      cacheCheck: 0,
      modelDetection: 0,
      sectionDetection: 0,
      promptBuild: 0,
      groqCall: 0,
      postProcessing: 0,
      promptMode: 'pdf_router',
    };
    const startTotal = Date.now();

    let isVideoPrompt = false;
    let modelTarget = null;
    let promptSection = null;

    try {
      logger.info('Getting enhancement suggestions', {
        highlightedLength: highlightedText?.length,
        highlightedCategory: highlightedCategory || null,
        categoryConfidence: highlightedCategoryConfidence ?? null,
        highlightedPhrasePreview: highlightedPhrase
          ? String(highlightedPhrase).slice(0, 80)
          : undefined,
      });

      isVideoPrompt = this.videoService.isVideoPrompt(fullPrompt);
      const brainstormSignature = this.brainstormBuilder.buildBrainstormSignature(brainstormContext);
      const highlightWordCount = this.videoService.countWords(highlightedText);
      const phraseRole = isVideoPrompt
        ? this.videoService.detectVideoPhraseRole(
            highlightedText,
            contextBefore,
            contextAfter,
            highlightedCategory
          )
        : null;
      const videoConstraints = isVideoPrompt
        ? this.videoService.getVideoReplacementConstraints({
            highlightWordCount,
            phraseRole,
            highlightedText,
            highlightedCategory,
            highlightedCategoryConfidence,
          })
        : null;

      if (isVideoPrompt) {
        const modelStart = Date.now();
        modelTarget = this.videoService.detectTargetModel(fullPrompt);
        metrics.modelDetection = Date.now() - modelStart;

        const sectionStart = Date.now();
        promptSection = this.videoService.detectPromptSection(
          highlightedText,
          fullPrompt,
          contextBefore
        );
        metrics.sectionDetection = Date.now() - sectionStart;
      }

      logger.debug('Model and section detection', {
        isVideoPrompt,
        modelTarget: modelTarget || 'none detected',
        promptSection: promptSection || 'main_prompt',
        modelDetectionTime: metrics.modelDetection,
        sectionDetectionTime: metrics.sectionDetection,
      });

      const cacheStart = Date.now();
      const cacheKey = this._generateCacheKey({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        isVideoPrompt,
        brainstormSignature,
        highlightedCategory,
        highlightWordCount,
        phraseRole,
        videoConstraints,
        editHistory,
        modelTarget,
        promptSection,
      });

      const cached = await cacheService.get(cacheKey, 'enhancement');
      metrics.cacheCheck = Date.now() - cacheStart;

      if (cached) {
        metrics.cache = true;
        metrics.total = Date.now() - startTotal;
        metrics.promptMode = 'pdf_router';
        this._logMetrics(metrics, {
          highlightedCategory,
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
        brainstormContext,
        editHistory,
        modelTarget,
        isVideoPrompt,
        phraseRole,
        highlightedCategory,
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

      const groqStart = Date.now();
      
      // PDF Enhancement: Try contrastive decoding for enhanced diversity
      let suggestions = await this.contrastiveDiversity.generateWithContrastiveDecoding({
        systemPrompt,
        schema,
        isVideoPrompt,
        isPlaceholder,
        highlightedText,
      });
      
      let usedContrastiveDecoding = false;
      
      // Fallback to standard generation if contrastive decoding not used/failed
      if (!suggestions) {
        suggestions = await StructuredOutputEnforcer.enforceJSON(
          this.ai,
          systemPrompt,
          {
            schema,
            isArray: true,
            maxTokens: 2048,
            maxRetries: 2,
            temperature,
            operation: 'enhance_suggestions',
          }
        );
      } else {
        usedContrastiveDecoding = true;
        
        // Calculate and log diversity metrics
        const diversityMetrics = this.contrastiveDiversity.calculateDiversityMetrics(suggestions);
        logger.info('Contrastive decoding diversity metrics', diversityMetrics);
      }
      
      metrics.groqCall = Date.now() - groqStart;
      metrics.usedContrastiveDecoding = usedContrastiveDecoding;

      const poisonousPatterns = [
        'specific element detail',
        'alternative aspect feature',
        'varied choice showcasing',
        'different variant featuring',
        'alternative option with specific',
        'distinctive',
        'remarkable',
        'notable'
      ];

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
        isPlaceholder,
        suggestionsCount: Array.isArray(suggestions) ? suggestions.length : 0,
        hasCategory: suggestions?.[0]?.category !== undefined,
        phraseRole,
        videoConstraintMode: videoConstraints?.mode || null,
        highlightWordCount,
        zeroShotActive: true,
        hasPoisonousText,
        sampleSuggestions,
      });

      if (hasPoisonousText) {
        logger.warn('ALERT: Poisonous example patterns detected in zero-shot suggestions!', {
          highlightedText,
          highlightedCategory,
          suggestions: suggestions.map((s) => s.text),
        });
      }

      const postStart = Date.now();
      const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(suggestions);

      const alignmentResult = this._applyCategoryAlignment(
        diverseSuggestions,
        highlightedCategory,
        highlightedText,
        highlightedCategoryConfidence
      );

      const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
        alignmentResult.suggestions,
        {
          highlightedText,
          isPlaceholder,
          isVideoPrompt,
          videoConstraints,
        }
      );

      const fallbackResult = await this.fallbackRegeneration.attemptFallbackRegeneration({
        sanitizedSuggestions,
        isVideoPrompt,
        isPlaceholder,
        videoConstraints,
        regenerationDetails: {
          highlightWordCount,
          phraseRole,
          highlightedText,
          highlightedCategory,
          highlightedCategoryConfidence,
        },
        requestParams: {
          highlightedText,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt,
          isVideoPrompt,
          isPlaceholder,
          brainstormContext,
          phraseRole,
          highlightWordCount,
          highlightedCategory,
          highlightedCategoryConfidence,
          editHistory,
          modelTarget,
          promptSection,
        },
        aiService: this.ai,
        schema,
        temperature,
      });

      let suggestionsToUse = fallbackResult.suggestions;
      const activeConstraints = fallbackResult.constraints;
      let usedFallback = fallbackResult.usedFallback;
      const fallbackSourceCount = fallbackResult.sourceCount;

      if (suggestionsToUse.length === 0) {
        const descriptorResult = this.suggestionProcessor.applyDescriptorFallbacks(
          suggestionsToUse,
          highlightedText
        );
        suggestionsToUse = descriptorResult.suggestions;
        if (descriptorResult.usedFallback) {
          usedFallback = true;
        }
      }

      logger.info('Processing suggestions for categorization', {
        isPlaceholder,
        hasCategoryField: suggestionsToUse[0]?.category !== undefined,
        totalSuggestions: suggestionsToUse.length,
        sanitizedCount: sanitizedSuggestions.length,
        appliedConstraintMode: activeConstraints?.mode || null,
        usedFallback,
      });

      const groupedSuggestions = this.suggestionProcessor.groupSuggestions(
        suggestionsToUse,
        isPlaceholder
      );

      const result = this.suggestionProcessor.buildResult({
        groupedSuggestions,
        isPlaceholder,
        phraseRole,
        activeConstraints,
        alignmentFallbackApplied: alignmentResult.fallbackApplied,
        usedFallback,
        hasNoSuggestions: suggestionsToUse.length === 0,
      });

      metrics.postProcessing = Date.now() - postStart;

      this.suggestionProcessor.logResult(
        result,
        sanitizedSuggestions,
        usedFallback,
        fallbackSourceCount,
        suggestions
      );

      await cacheService.set(cacheKey, result, {
        ttl: this.cacheConfig.ttl,
      });

      metrics.total = Date.now() - startTotal;
      metrics.promptMode = 'pdf_router';
      this._logMetrics(metrics, {
        highlightedCategory,
        isVideoPrompt,
        modelTarget,
        promptSection,
      });
      this._checkLatencyThreshold(metrics);

      return result;
    } catch (error) {
      metrics.total = Date.now() - startTotal;
      metrics.promptMode = 'pdf_router';
      this._logMetrics(
        metrics,
        {
          highlightedCategory,
          isVideoPrompt,
          modelTarget,
          promptSection,
        },
        error
      );
      throw error;
    }
  }

  /**
   * Get custom suggestions based on user request
   * @param {Object} params - Custom suggestion parameters
   * @returns {Promise<Object>} Custom suggestions
   */
  async getCustomSuggestions({ highlightedText, customRequest, fullPrompt }) {
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

    const cached = await cacheService.get(cacheKey, 'enhancement');
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

    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.ai,
      systemPrompt,
      {
        operation: 'custom_suggestions',
        schema,
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
   * @param {string} text - Text to transform
   * @param {string} targetStyle - Target style
   * @returns {Promise<string>} Transformed text
   */
  async transferStyle(text, targetStyle) {
    return this.styleTransfer.transferStyle(text, targetStyle);
  }

  /**
   * Generate cache key for enhancement request
   * Includes edit/model context for cache separation
   * @private
   */
  _generateCacheKey(params) {
    let editFingerprint = null;
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
  _applyCategoryAlignment(suggestions, highlightedCategory, highlightedText, confidence) {
    if (!highlightedCategory) {
      return { suggestions, fallbackApplied: false, context: {} };
    }

    const alignmentResult = this.categoryAligner.enforceCategoryAlignment(suggestions || [], {
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence: confidence,
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

  /**
   * Log metrics for enhancement request
   * @private
   */
  _logMetrics(metrics, params, error = null) {
    const isDev = process.env.NODE_ENV === 'development';

    // Console logging in development
    if (isDev) {
      console.log('\n=== Enhancement Service Performance ===');
      console.log(`Total: ${metrics.total}ms`);
      console.log(`Prompt Mode: ${metrics.promptMode || 'pdf_router'}`);
      console.log(`Cache: ${metrics.cache ? 'HIT' : 'MISS'} (${metrics.cacheCheck}ms)`);

      if (metrics.modelDetection > 0) {
        console.log(`Model Detection: ${metrics.modelDetection}ms`);
      }
      if (metrics.sectionDetection > 0) {
        console.log(`Section Detection: ${metrics.sectionDetection}ms`);
      }
      if (metrics.promptBuild > 0) {
        console.log(`Prompt Build: ${metrics.promptBuild}ms`);
      }
      if (metrics.groqCall > 0) {
        console.log(`Groq Call: ${metrics.groqCall}ms`);
      }
      if (metrics.postProcessing > 0) {
        console.log(`Post-Processing: ${metrics.postProcessing}ms`);
      }
      
      console.log('======================================\n');
    }

    // Send to metrics service in production
    if (this.metricsService && !isDev) {
      this.metricsService.recordEnhancementTiming(metrics, {
        category: params.highlightedCategory || 'unknown',
        isVideo: params.isVideoPrompt,
        modelTarget: params.modelTarget,
        promptSection: params.promptSection,
        promptMode: metrics.promptMode || 'pdf_router',
        error: error?.message,
      });
    }

    // Always log to structured logger
    logger.info('Enhancement request completed', {
      ...metrics,
      category: params.highlightedCategory,
      isVideo: params.isVideoPrompt,
      modelTarget: params.modelTarget,
      promptSection: params.promptSection,
      promptMode: metrics.promptMode || 'pdf_router',
      error: error?.message,
    });
  }

  /**
   * Check if latency threshold was exceeded and alert if necessary
   * @private
   */
  _checkLatencyThreshold(metrics) {
    if (metrics.total > 2000) {
      logger.warn('Enhancement request exceeded latency threshold', {
        total: metrics.total,
        threshold: 2000,
        breakdown: {
          cacheCheck: metrics.cacheCheck,
          modelDetection: metrics.modelDetection,
          sectionDetection: metrics.sectionDetection,
          promptBuild: metrics.promptBuild,
          groq: metrics.groqCall,
          postProcessing: metrics.postProcessing,
        },
      });

      // Alert in production
      if (process.env.NODE_ENV === 'production' && this.metricsService) {
        this.metricsService.recordAlert('enhancement_latency_exceeded', {
          total: metrics.total,
          threshold: 2000,
        });
      }
    }
  }
}
