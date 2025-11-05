import { logger } from '../../infrastructure/Logger.js';
import { cacheService } from '../CacheService.js';
import { StructuredOutputEnforcer } from '../../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../../utils/TemperatureOptimizer.js';
import { getEnhancementSchema, getCustomSuggestionSchema } from './config/schemas.js';
import { FallbackRegenerationService } from './services/FallbackRegenerationService.js';
import { SuggestionProcessor } from './services/SuggestionProcessor.js';
import { StyleTransferService } from './services/StyleTransferService.js';

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
    claudeClient,
    groqClient,
    placeholderDetector,
    videoService,
    brainstormBuilder,
    promptBuilder,
    validationService,
    diversityEnforcer,
    categoryAligner
  ) {
    this.claudeClient = claudeClient;
    this.groqClient = groqClient;
    this.placeholderDetector = placeholderDetector;
    this.videoService = videoService;
    this.brainstormBuilder = brainstormBuilder;
    this.promptBuilder = promptBuilder;
    this.validationService = validationService;
    this.diversityEnforcer = diversityEnforcer;
    this.categoryAligner = categoryAligner;
    this.cacheConfig = cacheService.getConfig('enhancement');

    // Initialize specialized services
    this.fallbackRegeneration = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer
    );
    this.suggestionProcessor = new SuggestionProcessor(validationService);
    this.styleTransfer = new StyleTransferService(claudeClient);
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
  }) {
    logger.info('Getting enhancement suggestions', {
      highlightedLength: highlightedText?.length,
      highlightedCategory: highlightedCategory || null,
      categoryConfidence: highlightedCategoryConfidence ?? null,
      highlightedPhrasePreview: highlightedPhrase
        ? String(highlightedPhrase).slice(0, 80)
        : undefined,
    });

    // Detect video prompt and compute metadata
    const isVideoPrompt = this.videoService.isVideoPrompt(fullPrompt);
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

    // Check cache
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
    });

    const cached = await cacheService.get(cacheKey, 'enhancement');
    if (cached) {
      logger.debug('Cache hit for enhancement suggestions');
      return cached;
    }

    // Detect placeholder
    const isPlaceholder = this.placeholderDetector.detectPlaceholder(
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt
    );

    // Build prompt
    const systemPrompt = this._buildSystemPrompt({
      isPlaceholder,
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt,
      originalUserPrompt,
      isVideoPrompt,
      brainstormContext,
      highlightedCategory,
      highlightedCategoryConfidence,
      phraseRole,
      highlightWordCount,
      videoConstraints,
    });

    // Generate initial suggestions
    const schema = getEnhancementSchema(isPlaceholder);
    const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
    });

    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.groqClient || this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    logger.info('Raw suggestions from Claude', {
      isPlaceholder,
      suggestionsCount: Array.isArray(suggestions) ? suggestions.length : 0,
      hasCategory: suggestions?.[0]?.category !== undefined,
      phraseRole,
      videoConstraintMode: videoConstraints?.mode || null,
      highlightWordCount,
    });

    // Process suggestions
    const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(suggestions);

    // Apply category alignment if needed
    const alignmentResult = this._applyCategoryAlignment(
      diverseSuggestions,
      highlightedCategory,
      highlightedText,
      highlightedCategoryConfidence
    );

    // Sanitize suggestions
    const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
      alignmentResult.suggestions,
      {
        highlightedText,
        isPlaceholder,
        isVideoPrompt,
        videoConstraints,
      }
    );

    // Attempt fallback regeneration if needed
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
        brainstormContext,
        phraseRole,
        highlightWordCount,
        highlightedCategory,
        highlightedCategoryConfidence,
      },
      claudeClient: this.claudeClient,
      groqClient: this.groqClient,
      schema,
      temperature,
    });

    let suggestionsToUse = fallbackResult.suggestions;
    const activeConstraints = fallbackResult.constraints;
    const usedFallback = fallbackResult.usedFallback;
    const fallbackSourceCount = fallbackResult.sourceCount;

    // Try descriptor fallbacks if still no suggestions
    if (suggestionsToUse.length === 0) {
      const descriptorResult = this.suggestionProcessor.applyDescriptorFallbacks(
        suggestionsToUse,
        highlightedText
      );
      suggestionsToUse = descriptorResult.suggestions;
      if (descriptorResult.usedFallback) {
        usedFallback || (usedFallback = true);
      }
    }

    // Debug logging
    logger.info('Processing suggestions for categorization', {
      isPlaceholder,
      hasCategoryField: suggestionsToUse[0]?.category !== undefined,
      totalSuggestions: suggestionsToUse.length,
      sanitizedCount: sanitizedSuggestions.length,
      appliedConstraintMode: activeConstraints?.mode || null,
      usedFallback,
    });

    // Group suggestions
    const groupedSuggestions = this.suggestionProcessor.groupSuggestions(
      suggestionsToUse,
      isPlaceholder
    );

    // Build final result
    const result = this.suggestionProcessor.buildResult({
      groupedSuggestions,
      isPlaceholder,
      phraseRole,
      activeConstraints,
      alignmentFallbackApplied: alignmentResult.fallbackApplied,
      usedFallback,
      hasNoSuggestions: suggestionsToUse.length === 0,
    });

    // Log result
    this.suggestionProcessor.logResult(
      result,
      sanitizedSuggestions,
      usedFallback,
      fallbackSourceCount,
      suggestions
    );

    // Cache result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    return result;
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
      this.groqClient || this.claudeClient,
      systemPrompt,
      {
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
   * @private
   */
  _generateCacheKey(params) {
    return cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText: params.highlightedText,
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      fullPrompt: params.fullPrompt.substring(0, 500),
      originalUserPrompt: (params.originalUserPrompt || '').substring(0, 500),
      isVideoPrompt: params.isVideoPrompt,
      brainstormSignature: params.brainstormSignature,
      highlightedCategory: params.highlightedCategory || null,
      highlightWordCount: params.highlightWordCount,
      phraseRole: params.phraseRole,
      videoConstraintMode: params.videoConstraints?.mode || null,
    });
  }

  /**
   * Build system prompt based on context
   * @private
   */
  _buildSystemPrompt(params) {
    return params.isPlaceholder
      ? this.promptBuilder.buildPlaceholderPrompt(params)
      : this.promptBuilder.buildRewritePrompt(params);
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
}

