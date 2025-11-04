import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import { detectDescriptorCategory, getCategoryFallbacks } from './DescriptorCategories.js';

/**
 * EnhancementService (Refactored)
 *
 * Orchestrates enhancement suggestion generation by coordinating specialized services.
 * This service focuses purely on orchestration and delegates domain logic to specialized services.
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

    // Delegate to VideoPromptService for video-related detection
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

    // Check cache first
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt: fullPrompt.substring(0, 500), // Partial for cache key
      originalUserPrompt: (originalUserPrompt || '').substring(0, 500),
      isVideoPrompt,
      brainstormSignature,
      highlightedCategory: highlightedCategory || null,
      highlightWordCount,
      phraseRole,
      videoConstraintMode: videoConstraints?.mode || null,
    });

    const cached = await cacheService.get(cacheKey, 'enhancement');
    if (cached) {
      logger.debug('Cache hit for enhancement suggestions');
      return cached;
    }

    // Delegate to PlaceholderDetectionService
    const isPlaceholder = this.placeholderDetector.detectPlaceholder(
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt
    );

    // Delegate to PromptBuilderService
    const systemPrompt = isPlaceholder
      ? this.promptBuilder.buildPlaceholderPrompt({
          highlightedText,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt,
          isVideoPrompt,
          brainstormContext,
          highlightedCategory,
          highlightedCategoryConfidence,
        })
      : this.promptBuilder.buildRewritePrompt({
          highlightedText,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt,
          isVideoPrompt,
          brainstormContext,
          phraseRole,
          highlightWordCount,
          videoConstraints,
          highlightedCategory,
          highlightedCategoryConfidence,
        });

    // Define schema for validation
    const schema = {
      type: 'array',
      items: {
        required: ['text', 'explanation', ...(isPlaceholder ? ['category'] : [])],
      },
    };

    // Get optimal temperature for enhancement
    const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
    });

    // Call Groq API for 8x faster suggestions (with Claude fallback)
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.groqClient || this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: true, // Expecting array of suggestions
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Log raw suggestions from Claude
    logger.info('Raw suggestions from Claude', {
      isPlaceholder,
      suggestionsCount: Array.isArray(suggestions) ? suggestions.length : 0,
      hasCategory: suggestions?.[0]?.category !== undefined,
      phraseRole,
      videoConstraintMode: videoConstraints?.mode || null,
      highlightWordCount,
    });

    // Delegate to SuggestionDiversityEnforcer
    const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(suggestions);

    // Detect if this is a descriptor-type phrase (for Video Concept Builder)
    const descriptorDetection = detectDescriptorCategory(highlightedText);
    const isDescriptorPhrase = descriptorDetection.confidence > 0.4;

    logger.debug('Descriptor detection', {
      isDescriptorPhrase,
      category: descriptorDetection.category,
      confidence: descriptorDetection.confidence,
    });

    // Delegate to CategoryAlignmentService
    let alignmentResult = { suggestions: diverseSuggestions, fallbackApplied: false, context: {} };

    if (highlightedCategory) {
      alignmentResult = this.categoryAligner.enforceCategoryAlignment(
        diverseSuggestions || [],
        {
          highlightedText,
          highlightedCategory,
          highlightedCategoryConfidence,
        }
      );

      if (alignmentResult.fallbackApplied) {
        logger.info('Applied category fallbacks', {
          highlightedText: highlightedText,
          category: highlightedCategory,
          reason: alignmentResult.context.reason,
        });
      }
    }

    // Delegate to SuggestionValidationService for sanitization
    const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
      alignmentResult.suggestions,
      {
        highlightedText,
        isPlaceholder,
        isVideoPrompt,
        videoConstraints,
      }
    );

    let suggestionsToUse = sanitizedSuggestions;
    let activeConstraints = videoConstraints;
    let usedFallback = false;
    let fallbackSourceCount = Array.isArray(suggestions) ? suggestions.length : 0;
    const attemptedModes = new Set();
    if (activeConstraints?.mode) {
      attemptedModes.add(activeConstraints.mode);
    }

    const regenerationDetails = {
      highlightWordCount,
      phraseRole,
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence,
    };

    // Fallback regeneration logic for video prompts
    if (suggestionsToUse.length === 0 && isVideoPrompt && !isPlaceholder) {
      logger.warn('All suggestions removed during sanitization', {
        highlightWordCount,
        phraseRole,
        constraintMode: videoConstraints?.mode || null,
      });

      let currentConstraints = videoConstraints;
      let fallbackConstraints = this.videoService.getVideoFallbackConstraints(
        currentConstraints,
        regenerationDetails,
        attemptedModes
      );

      while (fallbackConstraints) {
        try {
          const fallbackPrompt = this.promptBuilder.buildRewritePrompt({
            highlightedText,
            contextBefore,
            contextAfter,
            fullPrompt,
            originalUserPrompt,
            isVideoPrompt,
            brainstormContext,
            phraseRole,
            highlightWordCount,
            videoConstraints: fallbackConstraints,
            highlightedCategory,
            highlightedCategoryConfidence,
          });

          const fallbackSuggestions = await StructuredOutputEnforcer.enforceJSON(
            this.groqClient || this.claudeClient,
            fallbackPrompt,
            {
              schema,
              isArray: true,
              maxTokens: 2048,
              maxRetries: 1,
              temperature,
            }
          );

          const fallbackDiverse = await this.diversityEnforcer.ensureDiverseSuggestions(
            fallbackSuggestions
          );
          const fallbackSanitized = this.validationService.sanitizeSuggestions(fallbackDiverse, {
            highlightedText,
            isPlaceholder,
            isVideoPrompt,
            videoConstraints: fallbackConstraints,
          });

          if (fallbackSanitized.length > 0) {
            suggestionsToUse = fallbackSanitized;
            activeConstraints = fallbackConstraints;
            usedFallback = true;
            fallbackSourceCount = Array.isArray(fallbackSuggestions)
              ? fallbackSuggestions.length
              : 0;
            break;
          }

          logger.warn('Fallback attempt yielded no compliant suggestions', {
            modeTried: fallbackConstraints.mode,
            generatedCount: Array.isArray(fallbackSuggestions)
              ? fallbackSuggestions.length
              : 0,
            sanitizedCount: fallbackSanitized.length,
          });
        } catch (error) {
          logger.warn('Fallback regeneration failed', {
            mode: fallbackConstraints.mode,
            error: error.message,
          });
        }

        attemptedModes.add(fallbackConstraints.mode);
        currentConstraints = fallbackConstraints;
        fallbackConstraints = this.videoService.getVideoFallbackConstraints(
          currentConstraints,
          regenerationDetails,
          attemptedModes
        );
      }
    }

    // Try descriptor fallbacks if needed
    if (suggestionsToUse.length === 0) {
      logger.info('No sanitized suggestions available after regeneration attempts', {
        phraseRole,
        highlightWordCount,
        attemptedModes: Array.from(attemptedModes),
      });

      // Try descriptor fallbacks if this is a descriptor phrase
      if (isDescriptorPhrase && descriptorDetection.category) {
        const descriptorFallbacks = getCategoryFallbacks(descriptorDetection.category);
        if (descriptorFallbacks.length > 0) {
          logger.info('Using descriptor category fallbacks', {
            category: descriptorDetection.category,
            count: descriptorFallbacks.length,
          });
          suggestionsToUse = descriptorFallbacks;
          usedFallback = true;
        }
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
      isDescriptorPhrase,
      descriptorCategory: isDescriptorPhrase ? descriptorDetection.category : null,
    });

    // Delegate to SuggestionValidationService for grouping
    const groupedSuggestions =
      isPlaceholder && suggestionsToUse[0]?.category
        ? this.validationService.groupSuggestionsByCategory(suggestionsToUse)
        : suggestionsToUse;

    const result = {
      suggestions: groupedSuggestions,
      isPlaceholder,
      hasCategories: isPlaceholder && suggestionsToUse[0]?.category ? true : false,
      phraseRole: phraseRole || null,
      appliedConstraintMode: activeConstraints?.mode || null,
      fallbackApplied: alignmentResult.fallbackApplied || usedFallback,
    };

    if (activeConstraints) {
      result.appliedVideoConstraints = activeConstraints;
    }

    if (suggestionsToUse.length === 0) {
      result.noSuggestionsReason =
        'No template-compliant drop-in replacements were generated for this highlight.';
    }

    logger.info('Final result structure', {
      isGrouped:
        Array.isArray(groupedSuggestions) &&
        groupedSuggestions[0]?.suggestions !== undefined,
      categoriesCount: groupedSuggestions[0]?.suggestions ? groupedSuggestions.length : 0,
      hasCategories: result.hasCategories,
      appliedConstraintMode: result.appliedConstraintMode || null,
    });

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    let baseSuggestionCount;
    if (usedFallback) {
      baseSuggestionCount = fallbackSourceCount;
    } else if (Array.isArray(suggestions)) {
      baseSuggestionCount = suggestions.length;
    } else {
      baseSuggestionCount = 0;
    }

    logger.info('Enhancement suggestions generated', {
      count: suggestionsToUse.length,
      type: isPlaceholder ? 'placeholder' : 'rewrite',
      diversityEnforced: suggestionsToUse.length !== baseSuggestionCount,
      appliedConstraintMode: activeConstraints?.mode || null,
      usedFallback,
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

    // Delegate to VideoPromptService
    const isVideoPrompt = this.videoService.isVideoPrompt(fullPrompt);

    // Delegate to PromptBuilderService
    const systemPrompt = this.promptBuilder.buildCustomPrompt({
      highlightedText,
      customRequest,
      fullPrompt,
      isVideoPrompt,
    });

    // Define schema for validation
    const schema = {
      type: 'array',
      items: {
        required: ['text'],
      },
    };

    // Get optimal temperature for custom suggestions
    const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
    });

    // Call Groq API for 8x faster suggestions (with Claude fallback)
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.groqClient || this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: true, // Expecting array of suggestions
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Delegate to SuggestionDiversityEnforcer
    const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(suggestions);

    const result = { suggestions: diverseSuggestions };

    // Cache the result
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
   * @param {string} targetStyle - Target style (technical, creative, academic, casual, formal)
   * @returns {Promise<string>} Transformed text
   */
  async transferStyle(text, targetStyle) {
    const styles = {
      technical: {
        formality: 'high',
        jargon: 'specialized',
        structure: 'systematic',
        tone: 'objective',
        examples: 'code snippets, specifications, metrics',
      },
      creative: {
        formality: 'low',
        jargon: 'accessible',
        structure: 'flowing',
        tone: 'engaging',
        examples: 'metaphors, imagery, narrative',
      },
      academic: {
        formality: 'high',
        jargon: 'scholarly',
        structure: 'argumentative',
        tone: 'authoritative',
        examples: 'citations, evidence, analysis',
      },
      casual: {
        formality: 'low',
        jargon: 'everyday',
        structure: 'conversational',
        tone: 'friendly',
        examples: 'personal anecdotes, simple comparisons',
      },
      formal: {
        formality: 'high',
        jargon: 'professional',
        structure: 'hierarchical',
        tone: 'respectful',
        examples: 'case studies, reports, documentation',
      },
    };

    const styleConfig = styles[targetStyle] || styles.formal;

    const styleTransferPrompt = `Transform the following text to ${targetStyle} style while preserving its core meaning and information.

Original text: "${text}"

Target style characteristics:
- Formality level: ${styleConfig.formality}
- Language type: ${styleConfig.jargon}
- Structure: ${styleConfig.structure}
- Tone: ${styleConfig.tone}
- Examples style: ${styleConfig.examples}

Requirements:
1. Maintain all factual information from the original
2. Adapt vocabulary to match the target style
3. Restructure sentences appropriately for the style
4. Preserve the core message and intent
5. Make it feel natural in the new style

Provide ONLY the transformed text, no explanations:`;

    try {
      const response = await this.claudeClient.complete(styleTransferPrompt, {
        maxTokens: 1024,
        temperature: 0.7,
      });

      return response.content[0].text.trim();
    } catch (error) {
      logger.warn('Failed to transfer style', { error });
      return text; // Return original on error
    }
  }
}
