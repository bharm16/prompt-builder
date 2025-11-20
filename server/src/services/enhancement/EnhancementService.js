import { logger } from '../../infrastructure/Logger.js';
import { cacheService } from '../cache/CacheService.js';
import { StructuredOutputEnforcer } from '../../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../../utils/TemperatureOptimizer.js';
import { getEnhancementSchema, getCustomSuggestionSchema } from './config/schemas.js';
import { FallbackRegenerationService } from './services/FallbackRegenerationService.js';
import { SuggestionProcessor } from './services/SuggestionProcessor.js';
import { StyleTransferService } from './services/StyleTransferService.js';
import { SemanticDependencyAnalyzer } from './services/SemanticDependencyAnalyzer.js';
import { GrammaticalAnalysisService } from './services/GrammaticalAnalysisService.js';
import { ResilientGenerationService } from './services/ResilientGenerationService.js';
import { FallbackStrategyService } from './services/FallbackStrategyService.js';
import { GRAMMATICAL_CONFIG } from './config/grammaticalAnalysis.js';

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
    this.cacheConfig = cacheService.getConfig('enhancement');

    // Initialize specialized services
    this.fallbackRegeneration = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer
    );
    this.suggestionProcessor = new SuggestionProcessor(validationService);
    this.styleTransfer = new StyleTransferService(aiService);
    this.dependencyAnalyzer = new SemanticDependencyAnalyzer();

    // Initialize grammatical analysis services
    this.grammaticalAnalyzer = new GrammaticalAnalysisService(GRAMMATICAL_CONFIG);
    this.resilientGenerator = new ResilientGenerationService(
      this.ai,
      this.promptBuilder
    );
    this.fallbackStrategy = new FallbackStrategyService();
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
    allLabeledSpans = [], // Complete span composition
    nearbySpans = [], // Proximate context
    editHistory = [], // NEW: Edit history for consistency
  }) {
    // Initialize metrics tracking
    const metrics = {
      total: 0,
      cache: false,
      cacheCheck: 0,
      semanticDeps: 0,
      modelDetection: 0,
      sectionDetection: 0,
      groqCall: 0,
      postProcessing: 0,
      grammaticalAnalysis: 0, // NEW: Grammatical complexity analysis time
      complexHandling: 0, // NEW: Complex span handling time
      retryAttempts: 0, // NEW: Number of retry attempts
      fallbackUsed: false, // NEW: Whether algorithmic fallback was used
    };
    const startTotal = Date.now();

    // Declare variables outside try block so they're accessible in catch
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

      // Detect video prompt and compute metadata
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

      // Detect model target and prompt section for video prompts
      
      if (isVideoPrompt) {
        const modelStart = Date.now();
        modelTarget = this.videoService.detectTargetModel(fullPrompt);
        metrics.modelDetection = Date.now() - modelStart;

        const sectionStart = Date.now();
        promptSection = this.videoService.detectPromptSection(highlightedText, fullPrompt, contextBefore);
        metrics.sectionDetection = Date.now() - sectionStart;
      }

      logger.debug('Model and section detection', {
        isVideoPrompt,
        modelTarget: modelTarget || 'none detected',
        promptSection: promptSection || 'main_prompt',
        modelDetectionTime: metrics.modelDetection,
        sectionDetectionTime: metrics.sectionDetection,
      });

      // Check cache
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
      allLabeledSpans,
      nearbySpans,
      editHistory,
      modelTarget,
      promptSection,
    });

      const cached = await cacheService.get(cacheKey, 'enhancement');
      metrics.cacheCheck = Date.now() - cacheStart;
      
      if (cached) {
        metrics.cache = true;
        metrics.total = Date.now() - startTotal;
        this._logMetrics(metrics, {
          highlightedCategory,
          isVideoPrompt,
          modelTarget,
          promptSection,
        });
        logger.debug('Cache hit for enhancement suggestions', {
          cacheCheckTime: metrics.cacheCheck,
          totalTime: metrics.total,
        });
        return cached;
      }

      // Detect placeholder
      const isPlaceholder = this.placeholderDetector.detectPlaceholder(
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt
    );

      // Analyze semantic dependencies
      const semanticStart = Date.now();
      const elementDependencies = this.dependencyAnalyzer.detectElementDependencies(
        highlightedCategory,
        brainstormContext
      );
      const dependencyContext = this.dependencyAnalyzer.buildDependencyContext(
        highlightedCategory,
        elementDependencies
      );
      metrics.semanticDeps = Date.now() - semanticStart;

      logger.debug('Semantic dependency analysis', {
        highlightedCategory,
        dependencyCount: Object.keys(elementDependencies).length,
        hasDependencyContext: Boolean(dependencyContext),
        analysisTime: metrics.semanticDeps,
      });

    // Log span context for debugging
    logger.debug('Span context analysis', {
      totalSpans: allLabeledSpans.length,
      nearbySpansCount: nearbySpans.length,
      hasSpanContext: allLabeledSpans.length > 0,
    });

    // Log edit history for debugging
    logger.debug('Edit history analysis', {
      editCount: editHistory.length,
      hasEditHistory: editHistory.length > 0,
    });

    // Analyze grammatical complexity
    const grammaticalStart = Date.now();
    const grammaticalAnalysis = this.grammaticalAnalyzer.analyzeSpan(
      highlightedText,
      { contextBefore, contextAfter }
    );
    metrics.grammaticalAnalysis = Date.now() - grammaticalStart;

    logger.debug('Grammatical complexity analysis', {
      structure: grammaticalAnalysis.structure,
      complexity: grammaticalAnalysis.complexity.toFixed(3),
      tense: grammaticalAnalysis.tense,
      requiresComplexHandling: this._requiresComplexHandling(grammaticalAnalysis),
      analysisTime: metrics.grammaticalAnalysis,
    });

    // Route to complex handling if needed
    if (this._requiresComplexHandling(grammaticalAnalysis)) {
      logger.info('Routing to complex span handler', {
        structure: grammaticalAnalysis.structure,
        complexity: grammaticalAnalysis.complexity.toFixed(3),
      });

      return this._handleComplexSpan({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        brainstormContext,
        highlightedCategory,
        highlightedCategoryConfidence,
        highlightedPhrase,
        allLabeledSpans,
        nearbySpans,
        editHistory,
        isVideoPrompt,
        phraseRole,
        highlightWordCount,
        videoConstraints,
        dependencyContext,
        elementDependencies,
        modelTarget,
        promptSection,
        grammaticalAnalysis,
        metrics,
        startTotal,
      });
    }

    // Continue with existing simple path for non-complex spans
    logger.debug('Using standard enhancement path', {
      structure: grammaticalAnalysis.structure,
      complexity: grammaticalAnalysis.complexity.toFixed(3),
    });

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
      dependencyContext,
      elementDependencies,
      allLabeledSpans, // Complete composition
      nearbySpans, // Proximate context
      editHistory, // Edit history for consistency
      modelTarget, // NEW: Target AI model
      promptSection, // NEW: Template section
    });

      // Generate initial suggestions
      const schema = getEnhancementSchema(isPlaceholder);
      const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
        diversity: 'high',
        precision: 'medium',
      });

      const groqStart = Date.now();
      const suggestions = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        systemPrompt,
        {
          schema,
          isArray: true,
          maxTokens: 2048,
          maxRetries: 2,
          temperature,
          operation: 'enhance_suggestions', // Route through aiService
        }
      );
      metrics.groqCall = Date.now() - groqStart;

    logger.info('Raw suggestions from Claude', {
      isPlaceholder,
      suggestionsCount: Array.isArray(suggestions) ? suggestions.length : 0,
      hasCategory: suggestions?.[0]?.category !== undefined,
      phraseRole,
      videoConstraintMode: videoConstraints?.mode || null,
      highlightWordCount,
    });

      // Process suggestions
      const postStart = Date.now();
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
      aiService: this.ai,
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

      metrics.postProcessing = Date.now() - postStart;

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

      // Complete metrics tracking
      metrics.total = Date.now() - startTotal;
      this._logMetrics(metrics, {
        highlightedCategory,
        isVideoPrompt,
        modelTarget,
        promptSection,
      });
      this._checkLatencyThreshold(metrics);

      return result;
    } catch (error) {
      // Track error metrics
      metrics.total = Date.now() - startTotal;
      this._logMetrics(metrics, {
        highlightedCategory,
        isVideoPrompt,
        modelTarget: null,
        promptSection: null,
      }, error);
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
   * Includes semantic fingerprint for dependency-aware caching
   * @private
   */
  _generateCacheKey(params) {
    // Build semantic fingerprint from element dependencies
    let semanticFingerprint = null;
    if (params.highlightedCategory && params.brainstormContext) {
      const deps = this.dependencyAnalyzer.detectElementDependencies(
        params.highlightedCategory,
        params.brainstormContext
      );
      if (Object.keys(deps).length > 0) {
        // Create stable fingerprint from sorted dependency values
        semanticFingerprint = Object.keys(deps)
          .sort()
          .map((key) => `${key}:${deps[key]}`)
          .join('|');
      }
    }

    // Build span context fingerprint
    let spanFingerprint = null;
    if (Array.isArray(params.allLabeledSpans) && params.allLabeledSpans.length > 0) {
      // Create compact fingerprint from span categories and positions
      spanFingerprint = params.allLabeledSpans
        .slice(0, 10) // Limit to first 10 spans for cache key
        .map((span) => `${span.category}@${span.start}`)
        .join(',');
    }

    // Build edit history fingerprint
    let editFingerprint = null;
    if (Array.isArray(params.editHistory) && params.editHistory.length > 0) {
      // Create compact fingerprint from recent edit patterns
      editFingerprint = params.editHistory
        .slice(-5) // Last 5 edits only
        .map((edit) => `${edit.category || 'n'}:${edit.original.substring(0, 10)}`)
        .join('|');
    }

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
      semanticFingerprint: semanticFingerprint || null,
      spanFingerprint: spanFingerprint || null,
      editFingerprint: editFingerprint || null,
      modelTarget: params.modelTarget || null,
      promptSection: params.promptSection || null,
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
      console.log(`Cache: ${metrics.cache ? 'HIT' : 'MISS'} (${metrics.cacheCheck}ms)`);
      
      if (metrics.semanticDeps > 0) {
        console.log(`Semantic Analysis: ${metrics.semanticDeps}ms`);
      }
      if (metrics.grammaticalAnalysis > 0) {
        console.log(`Grammatical Analysis: ${metrics.grammaticalAnalysis}ms`);
      }
      if (metrics.complexHandling > 0) {
        console.log(`Complex Handling: ${metrics.complexHandling}ms`);
      }
      if (metrics.retryAttempts > 0) {
        console.log(`Retry Attempts: ${metrics.retryAttempts}`);
      }
      if (metrics.fallbackUsed) {
        console.log(`Fallback: Algorithmic transformation used`);
      }
      if (metrics.modelDetection > 0) {
        console.log(`Model Detection: ${metrics.modelDetection}ms`);
      }
      if (metrics.sectionDetection > 0) {
        console.log(`Section Detection: ${metrics.sectionDetection}ms`);
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
          semanticDeps: metrics.semanticDeps,
          modelDetection: metrics.modelDetection,
          sectionDetection: metrics.sectionDetection,
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

  /**
   * Check if grammatical analysis indicates complex handling is needed
   * @param {Object} analysis - Grammatical analysis result
   * @returns {boolean} True if complex handling required
   * @private
   */
  _requiresComplexHandling(analysis) {
    return (
      analysis.complexity > GRAMMATICAL_CONFIG.complexityThreshold ||
      GRAMMATICAL_CONFIG.complexStructures.includes(analysis.structure)
    );
  }

  /**
   * Handle complex span enhancement with resilient generation and fallback
   * @param {Object} params - All enhancement parameters plus grammatical analysis
   * @returns {Promise<Object>} Enhancement result
   * @private
   */
  async _handleComplexSpan(params) {
    const { grammaticalAnalysis, highlightedText, metrics, startTotal } = params;
    const complexStart = Date.now();

    try {
      logger.info('Handling complex span', {
        text: highlightedText.substring(0, 50),
        structure: grammaticalAnalysis.structure,
        complexity: grammaticalAnalysis.complexity.toFixed(3),
      });

      // Attempt resilient generation with retry-validation loop
      const suggestions = await this.resilientGenerator.generate(
        params,
        grammaticalAnalysis
      );

      if (suggestions && suggestions.length > 0) {
        metrics.complexHandling = Date.now() - complexStart;
        metrics.retryAttempts = 0; // Tracked internally by resilient generator
        metrics.fallbackUsed = false;
        metrics.total = Date.now() - startTotal;

        this._logMetrics(metrics, params);

        logger.info('Complex span enhancement succeeded via AI', {
          suggestionsCount: suggestions.length,
          handleTime: metrics.complexHandling,
        });

        return this._formatComplexResult(suggestions, 'ai_enhanced');
      }

      // AI generation failed after retries - use algorithmic fallback
      logger.warn('Resilient generation failed, applying algorithmic fallback');

      const fallbackText = this.fallbackStrategy.generateFallback(
        highlightedText,
        grammaticalAnalysis
      );

      metrics.complexHandling = Date.now() - complexStart;
      metrics.fallbackUsed = true;
      metrics.total = Date.now() - startTotal;

      this._logMetrics(metrics, params);

      logger.info('Complex span enhancement succeeded via fallback', {
        originalText: highlightedText,
        fallbackText,
        handleTime: metrics.complexHandling,
      });

      return this._formatComplexResult(
        [{ text: fallbackText, explanation: 'Enhanced using algorithmic transformation' }],
        'algorithmic_fallback'
      );
    } catch (error) {
      logger.error('Complex span handling failed completely', {
        error: error.message,
        stack: error.stack,
      });

      metrics.complexHandling = Date.now() - complexStart;
      metrics.total = Date.now() - startTotal;

      this._logMetrics(metrics, params, error);

      // Return null to signal failure - caller can fall back to simple path
      return null;
    }
  }

  /**
   * Format complex span result with proper structure
   * @param {Array} suggestions - Array of suggestion objects
   * @param {string} source - Source of suggestions ('ai_enhanced' or 'algorithmic_fallback')
   * @returns {Object} Formatted result
   * @private
   */
  _formatComplexResult(suggestions, source) {
    return {
      suggestions: suggestions.map(s => ({
        text: s.text,
        explanation: s.explanation || `Enhanced via ${source.replace('_', ' ')}`,
        category: 'enhancement',
      })),
      metadata: {
        method: 'grammatical_analysis',
        source,
        timestamp: Date.now(),
      },
    };
  }
}

