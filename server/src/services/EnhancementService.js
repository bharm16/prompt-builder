import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import { CATEGORY_CONSTRAINTS, detectSubcategory, validateAgainstVideoTemplate } from './CategoryConstraints.js';

/**
 * Service for providing enhancement suggestions for highlighted text
 * Handles both placeholder value suggestions and general rewrites
 */
export class EnhancementService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
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

    const isVideoPrompt = this.isVideoPrompt(fullPrompt);
    const brainstormSignature = this.buildBrainstormSignature(brainstormContext);
    const highlightWordCount = this.countWords(highlightedText);
    const phraseRole = isVideoPrompt
      ? this.detectVideoPhraseRole(
          highlightedText,
          contextBefore,
          contextAfter,
          highlightedCategory
        )
      : null;
    const videoConstraints = isVideoPrompt
      ? this.getVideoReplacementConstraints(
          {
            highlightWordCount,
            phraseRole,
            highlightedText,
            highlightedCategory,
            highlightedCategoryConfidence,
          }
        )
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

    // Check if highlighted text is a placeholder/parameter
    const isPlaceholder = this.detectPlaceholder(
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt
    );

    // Build appropriate prompt
    const systemPrompt = isPlaceholder
      ? this.buildPlaceholderPrompt({
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
      : this.buildRewritePrompt({
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

    // Call Claude API with structured output enforcement
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.claudeClient,
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

    // Ensure diversity in suggestions
    const diverseSuggestions = await this.ensureDiverseSuggestions(suggestions);

    // Apply category alignment with fallbacks if needed
    let alignmentResult = { suggestions: diverseSuggestions, fallbackApplied: false, context: {} };

    if (highlightedCategory) {
      alignmentResult = this.enforceCategoryAlignment(
        diverseSuggestions || [],
        {
          highlightedText,
          highlightedCategory,
          highlightedCategoryConfidence
        }
      );

      if (alignmentResult.fallbackApplied) {
        logger.info('Applied category fallbacks', {
          highlightedText: highlightedText,
          category: highlightedCategory,
          reason: alignmentResult.context.reason
        });
      }
    }

    // Enforce template guardrails (particularly for video prompts)
    const sanitizedSuggestions = this.sanitizeSuggestions(alignmentResult.suggestions, {
      highlightedText,
      isPlaceholder,
      isVideoPrompt,
      videoConstraints,
    });

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

    if (suggestionsToUse.length === 0 && isVideoPrompt && !isPlaceholder) {
      logger.warn('All suggestions removed during sanitization', {
        highlightWordCount,
        phraseRole,
        constraintMode: videoConstraints?.mode || null,
      });

      let currentConstraints = videoConstraints;
      let fallbackConstraints = this.getVideoFallbackConstraints(
        currentConstraints,
        regenerationDetails,
        attemptedModes
      );

      while (fallbackConstraints) {
        try {
          const fallbackPrompt = this.buildRewritePrompt({
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
            this.claudeClient,
            fallbackPrompt,
            {
              schema,
              isArray: true,
              maxTokens: 2048,
              maxRetries: 1,
              temperature,
            }
          );

          const fallbackDiverse = await this.ensureDiverseSuggestions(
            fallbackSuggestions
          );
          const fallbackSanitized = this.sanitizeSuggestions(fallbackDiverse, {
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
        fallbackConstraints = this.getVideoFallbackConstraints(
          currentConstraints,
          regenerationDetails,
          attemptedModes
        );
      }
    }

    if (suggestionsToUse.length === 0) {
      logger.info('No sanitized suggestions available after regeneration attempts', {
        phraseRole,
        highlightWordCount,
        attemptedModes: Array.from(attemptedModes),
      });
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

    // Group suggestions by category if they have categories
    const groupedSuggestions = isPlaceholder && suggestionsToUse[0]?.category
      ? this.groupSuggestionsByCategory(suggestionsToUse)
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
  async getCustomSuggestions({
    highlightedText,
    customRequest,
    fullPrompt,
  }) {
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

    const isVideoPrompt = this.isVideoPrompt(fullPrompt);

    const systemPrompt = this.buildCustomPrompt({
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

    // Call Claude API with structured output enforcement
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: true, // Expecting array of suggestions
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Ensure diversity in custom suggestions too
    const diverseSuggestions = await this.ensureDiverseSuggestions(suggestions);

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
   * Enforce category alignment with fallbacks when needed
   */
  enforceCategoryAlignment(suggestions, params) {
    const { highlightedText, highlightedCategory, highlightedCategoryConfidence } = params;

    // Check if we need fallbacks
    const needsFallback = this.shouldUseFallback(suggestions, highlightedText, highlightedCategory);

    if (needsFallback) {
      const fallbacks = this.getCategoryFallbacks(highlightedText, highlightedCategory);
      return {
        suggestions: fallbacks,
        fallbackApplied: true,
        context: {
          baseCategory: highlightedCategory,
          originalSuggestionsRejected: suggestions.length,
          reason: 'Category mismatch or low confidence'
        }
      };
    }

    // Validate and filter suggestions
    const validSuggestions = this.validateSuggestions(suggestions, highlightedText, highlightedCategory);

    return {
      suggestions: validSuggestions,
      fallbackApplied: false,
      context: { baseCategory: highlightedCategory }
    };
  }

  /**
   * Determine if fallback suggestions should be used
   */
  shouldUseFallback(suggestions, highlightedText, category) {
    // Use fallback if no suggestions or very low count
    if (!suggestions || suggestions.length < 2) return true;

    // Check for category mismatches
    if (category === 'technical') {
      const subcategory = detectSubcategory(highlightedText, category);
      if (subcategory) {
        const constraint = CATEGORY_CONSTRAINTS.technical[subcategory];
        const validCount = suggestions.filter(s =>
          constraint.pattern.test(s.text)
        ).length;
        return validCount < suggestions.length * 0.5;
      }
    }

    // Check for audio suggestions in non-audio categories
    if (['technical', 'framing', 'descriptive'].includes(category)) {
      const audioCount = suggestions.filter(s =>
        /audio|sound|music|score/i.test(s.text) ||
        (s.category && s.category.toLowerCase().includes('audio'))
      ).length;
      if (audioCount > 0) return true;
    }

    // Check for lighting suggestions in style descriptors
    if (category === 'descriptive') {
      const lightingCount = suggestions.filter(s =>
        /light|shadow|glow|illuminat/i.test(s.text) ||
        (s.category && s.category.toLowerCase().includes('light'))
      ).length;
      return lightingCount > suggestions.length * 0.5;
    }

    return false;
  }

  /**
   * Get fallback suggestions for a category
   */
  getCategoryFallbacks(highlightedText, category) {
    const subcategory = detectSubcategory(highlightedText, category);

    // Get specific fallbacks for technical subcategories
    if (category === 'technical' && subcategory) {
      return CATEGORY_CONSTRAINTS.technical[subcategory].fallbacks;
    }

    // Get fallbacks for other categories
    if (CATEGORY_CONSTRAINTS[category]) {
      return CATEGORY_CONSTRAINTS[category].fallbacks;
    }

    // Generic fallbacks as last resort
    return [
      { text: "alternative option 1", category, explanation: "Alternative suggestion" },
      { text: "alternative option 2", category, explanation: "Different approach" },
      { text: "alternative option 3", category, explanation: "Creative variation" }
    ];
  }

  /**
   * Validate suggestions match expected category
   */
  validateSuggestions(suggestions, highlightedText, category) {
    if (!suggestions || !Array.isArray(suggestions)) return [];

    const subcategory = detectSubcategory(highlightedText, category);

    return suggestions.filter(suggestion => {
      // Basic validation
      if (!suggestion.text || typeof suggestion.text !== 'string') return false;

      // Skip audio suggestions for non-audio categories
      if (['technical', 'framing', 'lighting', 'descriptive'].includes(category)) {
        if (/audio|sound|music|score|orchestra/i.test(suggestion.text)) {
          return false;
        }
      }

      // Validate against video template requirements
      return validateAgainstVideoTemplate(suggestion, category, subcategory);
    });
  }

  /**
   * Detect if highlighted text is a placeholder
   * @private
   */
  detectPlaceholder(highlightedText, contextBefore, contextAfter, fullPrompt) {
    const text = highlightedText.toLowerCase().trim();

    // Enhanced Pattern 1: Material/substance detection
    const materialKeywords = [
      'wooden', 'wood', 'metal', 'metallic', 'glass', 'plastic',
      'stone', 'marble', 'granite', 'concrete', 'brick', 'ceramic',
      'fabric', 'leather', 'steel', 'iron', 'copper', 'brass',
      'aluminum', 'chrome', 'gold', 'silver', 'bronze'
    ];

    // Enhanced Pattern 2: Style/aesthetic detection
    const styleKeywords = [
      'modern', 'vintage', 'rustic', 'industrial', 'minimalist',
      'ornate', 'classic', 'contemporary', 'traditional', 'art deco',
      'gothic', 'baroque', 'victorian', 'scandinavian', 'bohemian'
    ];

    // Enhanced Pattern 3: Single word that's commonly a placeholder
    const placeholderKeywords = [
      'location',
      'place',
      'venue',
      'setting',
      'where',
      'person',
      'character',
      'who',
      'speaker',
      'audience',
      'time',
      'when',
      'date',
      'period',
      'era',
      'occasion',
      'style',
      'tone',
      'mood',
      'atmosphere',
      'event',
      'action',
      'activity',
      'scene',
      'color',
      'texture',
      'material',
      'angle',
      'perspective',
      'viewpoint',
    ];

    // Check if it's a material or style (very likely to be a placeholder value)
    if (materialKeywords.includes(text) || styleKeywords.includes(text)) {
      return true;
    }

    if (text.split(/\s+/).length <= 2 && placeholderKeywords.includes(text)) {
      return true;
    }

    // Pattern 4: Text in parentheses or brackets
    if (
      contextBefore.includes('(') ||
      contextAfter.startsWith(')') ||
      contextBefore.includes('[') ||
      contextAfter.startsWith(']')
    ) {
      return true;
    }

    // Pattern 5: Preceded by phrases like "such as", "like", "e.g."
    const precedingPhrases = [
      'such as',
      'like',
      'e.g.',
      'for example',
      'including',
      'specify',
    ];
    if (
      precedingPhrases.some((phrase) =>
        contextBefore.toLowerCase().includes(phrase)
      )
    ) {
      return true;
    }

    // Pattern 6: In a list or comma-separated context
    if (
      (contextBefore.includes(':') || contextBefore.includes('-')) &&
      text.split(/\s+/).length <= 3
    ) {
      return true;
    }

    // Pattern 7: Part of "include [word]" or "set [word]" pattern
    const includePattern =
      /\b(include|set|choose|specify|add|provide|give)\s+[^,\n]{0,20}$/i;
    if (includePattern.test(contextBefore)) {
      return true;
    }

    // Pattern 8: Adjective describing a physical property
    const physicalPropertyContext = /\b(desk|table|chair|wall|floor|surface|object|item|piece|structure)\b/i;
    if (physicalPropertyContext.test(contextAfter) && text.split(/\s+/).length <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Detect the semantic type of a placeholder for better categorization
   * @private
   */
  detectPlaceholderType(highlightedText, contextBefore, contextAfter) {
    const text = highlightedText.toLowerCase();
    const combinedContext = (contextBefore + ' ' + contextAfter).toLowerCase();

    // Material context
    if (/\b(desk|table|chair|furniture|surface|made of|constructed|built)\b/.test(combinedContext)) {
      return 'material';
    }

    // Style context
    if (/\b(style|design|aesthetic|look|appearance|decorated|themed)\b/.test(combinedContext)) {
      return 'style';
    }

    // Location context
    if (/\b(location|place|venue|setting|room|space|area|environment)\b/.test(combinedContext)) {
      return 'location';
    }

    // Time context
    if (/\b(time|when|period|era|age|century|year|season)\b/.test(combinedContext)) {
      return 'time';
    }

    // Person context
    if (/\b(person|character|individual|speaker|audience|role)\b/.test(combinedContext)) {
      return 'person';
    }

    // Default to analyzing the text itself
    const materialWords = ['wooden', 'metal', 'glass', 'stone', 'plastic', 'fabric'];
    const styleWords = ['modern', 'vintage', 'classic', 'rustic', 'minimalist'];
    const locationWords = ['location', 'place', 'venue', 'room'];

    if (materialWords.some(w => text.includes(w))) return 'material';
    if (styleWords.some(w => text.includes(w))) return 'style';
    if (locationWords.some(w => text.includes(w))) return 'location';

    return 'general';
  }

  /**
   * Check if this is a video prompt
   * @private
   */
  isVideoPrompt(fullPrompt) {
    if (typeof fullPrompt !== 'string' || fullPrompt.trim().length === 0) {
      return false;
    }

    const normalized = fullPrompt.toLowerCase();

    const legacyMarkers = ['**main prompt:**', '**technical parameters:**', 'camera movement:'];
    if (legacyMarkers.some((marker) => normalized.includes(marker))) {
      return true;
    }

    const modernTemplateMarkers = [
      '**prompt:**',
      '**guiding principles',
      '**writing rules',
      '**technical specs',
      '**alternative approaches',
      'variation 1 (different camera)',
      'variation 2 (different lighting/mood)',
    ];

    if (modernTemplateMarkers.some((marker) => normalized.includes(marker))) {
      return true;
    }

    const technicalFields = ['duration:', 'aspect ratio:', 'frame rate:', 'audio:'];
    const matchedTechFields = technicalFields.filter((field) => normalized.includes(field));
    if (normalized.includes('technical specs') && matchedTechFields.length >= 2) {
      return true;
    }

    if (matchedTechFields.length >= 3 && normalized.includes('alternative approaches')) {
      return true;
    }

    return false;
  }

  /**
   * Build a compact signature of brainstorm context for caching
   * @private
   */
  buildBrainstormSignature(brainstormContext) {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return null;
    }

    const { elements = {}, metadata = {} } = brainstormContext;

    const normalizedElements = Object.entries(elements).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          acc[key] = trimmed;
        }
      }
      return acc;
    }, {});

    const normalizedMetadata = {};
    if (metadata && typeof metadata === 'object') {
      if (typeof metadata.format === 'string' && metadata.format.trim()) {
        normalizedMetadata.format = metadata.format.trim();
      }

      if (metadata.technicalParams && typeof metadata.technicalParams === 'object') {
        const technicalEntries = Object.entries(metadata.technicalParams).reduce(
          (acc, [key, value]) => {
            if (value === undefined || value === null) {
              return acc;
            }

            if (typeof value === 'string') {
              const trimmedValue = value.trim();
              if (trimmedValue) {
                acc[key] = trimmedValue;
              }
              return acc;
            }

            if (Array.isArray(value)) {
              if (value.length > 0) {
                acc[key] = value;
              }
              return acc;
            }

            if (typeof value === 'object') {
              if (Object.keys(value).length > 0) {
                acc[key] = value;
              }
              return acc;
            }

            acc[key] = value;
            return acc;
          },
          {}
        );

        if (Object.keys(technicalEntries).length) {
          normalizedMetadata.technicalParams = technicalEntries;
        }
      }

      if (
        typeof metadata.validationScore === 'number' &&
        Number.isFinite(metadata.validationScore)
      ) {
        normalizedMetadata.validationScore = metadata.validationScore;
      }
    }

    const signature = {};
    if (Object.keys(normalizedElements).length) {
      signature.elements = normalizedElements;
    }
    if (Object.keys(normalizedMetadata).length) {
      signature.metadata = normalizedMetadata;
    }

    return Object.keys(signature).length ? signature : null;
  }

  /**
   * Build prompt for placeholder value suggestions
   * @private
   */
  buildPlaceholderPrompt({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    isVideoPrompt,
    brainstormContext,
    highlightedCategory,
    highlightedCategoryConfidence,
  }) {
    // Get specific constraints for this category if available
    const subcategory = detectSubcategory(highlightedText, highlightedCategory);
    let constraintInstruction = '';

    if (highlightedCategory === 'technical' && subcategory) {
      const constraint = CATEGORY_CONSTRAINTS.technical[subcategory];
      if (constraint) {
        constraintInstruction = `
CRITICAL REQUIREMENTS:
${constraint.instruction}
${constraint.forbidden}

Examples of valid suggestions: ${constraint.fallbacks.map(f => f.text).join(', ')}
`;
      }
    } else if (highlightedCategory && CATEGORY_CONSTRAINTS[highlightedCategory]) {
      const constraint = CATEGORY_CONSTRAINTS[highlightedCategory];
      constraintInstruction = `
CRITICAL REQUIREMENTS:
${constraint.instruction}
${constraint.forbidden || ''}
`;
    }

    // Detect the semantic type of the placeholder
    const placeholderType = this.detectPlaceholderType(highlightedText, contextBefore, contextAfter);
    const brainstormSection = this.buildBrainstormContextSection(brainstormContext, {
      includeCategoryGuidance: true,
      isVideoPrompt,
    });
    const contextIntegrationBullet = brainstormSection
      ? '- Respect the Creative Brainstorm anchors above when proposing categories and example replacements.'
      : '- Each category should still fit the overall context';
    const brainstormRequirement = brainstormSection
      ? '✓ Align categories and replacements with the Creative Brainstorm anchors above\n'
      : '';
    const modeRequirement = isVideoPrompt
      ? '✓ For video: consider different visual/cinematic approaches'
      : '✓ Different approaches to achieve the goal';

    return `You are an expert prompt engineer specializing in placeholder value suggestion with deep contextual understanding.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }${constraintInstruction ? `\n${constraintInstruction}` : ''}

<analysis_process>
Step 1: Identify the placeholder type and context
- Analyze: "${highlightedText}"
- Detected Type: ${placeholderType}
- Classify the semantic category and expected value type
- Context clues: What do the surrounding words suggest about expected value type?

Step 2: Generate DIVERSE CATEGORIES of suggestions
- CRITICAL: Do NOT generate all suggestions from the same category
- If placeholder is a material (like "wooden"), provide alternatives from DIFFERENT categories:
  * Different materials (metal, glass, stone, etc.)
  * Different styles (modern, vintage, rustic, etc.)
  * Different textures (smooth, rough, polished, etc.)
  * Different aesthetics (minimalist, ornate, industrial, etc.)

Step 3: Ensure categorical diversity
- Each suggestion should represent a DIFFERENT approach or category
- Avoid variations of the same thing (not just oak, walnut, cherry)
- Think broadly about what could replace this placeholder

Step 4: Consider context appropriateness
- Original user's intent: "${originalUserPrompt}"
${contextIntegrationBullet}
</analysis_process>

**Context Analysis:**
Full prompt: ${fullPrompt.substring(0, 1500)}

Surrounding context:
- Before: "${contextBefore}"
- **PLACEHOLDER**: "${highlightedText}"
- After: "${contextAfter}"

Original user request: "${originalUserPrompt}"

**Your Task:**
Generate 12-15 suggestions to replace "${highlightedText}" organized into 4-5 CATEGORIES with 2-4 suggestions per category.

**CRITICAL REQUIREMENTS:**
✓ Create 4-5 distinct categories
✓ Include 2-4 suggestions per category (not just one!)
✓ Categories should represent different conceptual approaches
✓ Each suggestion within a category should still be unique
✓ Include category label for ALL suggestions
✓ Direct drop-in replacements - no rewriting needed
✓ Keep each suggestion concise noun/descriptor phrase (1-4 words)
✓ Contextually appropriate despite being diverse
${brainstormRequirement}${modeRequirement}

**Output Format:**
Return ONLY a JSON array with categorized suggestions (2-4 per category):

[
  {"text": "oak", "category": "Natural Wood", "explanation": "Classic hardwood with prominent grain"},
  {"text": "walnut", "category": "Natural Wood", "explanation": "Premium dark wood with rich tones"},
  {"text": "mahogany", "category": "Natural Wood", "explanation": "Deep red-brown luxury wood"},
  {"text": "brushed steel", "category": "Modern Materials", "explanation": "Contemporary industrial aesthetic"},
  {"text": "glass", "category": "Modern Materials", "explanation": "Transparent/translucent modern look"},
  {"text": "chrome", "category": "Modern Materials", "explanation": "Reflective high-tech finish"},
  {"text": "marble", "category": "Stone & Mineral", "explanation": "Elegant stone with veining patterns"},
  {"text": "granite", "category": "Stone & Mineral", "explanation": "Durable speckled stone surface"},
  {"text": "quartz", "category": "Stone & Mineral", "explanation": "Engineered stone with consistent pattern"},
  {"text": "weathered", "category": "Surface Finishes", "explanation": "Aged, worn surface quality"},
  {"text": "polished", "category": "Surface Finishes", "explanation": "Smooth, reflective finish"},
  {"text": "distressed", "category": "Surface Finishes", "explanation": "Intentionally aged appearance"}
]`;
  }

  /**
   * Build prompt for rewrite suggestions
   * @private
   */
  buildRewritePrompt({
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
  }) {
    const brainstormSection = this.buildBrainstormContextSection(brainstormContext, {
      isVideoPrompt,
    });

    if (isVideoPrompt) {
      const resolvedHighlightWordCount = Number.isFinite(highlightWordCount)
        ? highlightWordCount
        : this.countWords(highlightedText);
      const resolvedPhraseRole =
        phraseRole ||
        this.detectVideoPhraseRole(
          highlightedText,
          contextBefore,
          contextAfter,
          highlightedCategory
        );
      const resolvedVideoConstraints =
        videoConstraints ||
        this.getVideoReplacementConstraints(
          {
            highlightWordCount: resolvedHighlightWordCount,
            phraseRole: resolvedPhraseRole,
            highlightedText,
            highlightedCategory,
            highlightedCategoryConfidence,
          }
        );

      const {
        minWords,
        maxWords,
        maxSentences = 1,
        disallowTerminalPunctuation,
        formRequirement,
        focusGuidance,
        extraRequirements = [],
        slotDescriptor,
        mode,
      } = resolvedVideoConstraints;

      const sentenceRequirementLabel =
        mode === 'micro'
          ? 'Noun phrase only (no sentences)'
          : maxSentences === 1
          ? 'Single sentence (no multi-sentence rewrites)'
          : `${maxSentences} sentences max`;

      const brainstormRequirementLine = brainstormSection
        ? '✓ Honor the Creative Brainstorm anchors above in every alternative\n'
        : '';

      const focusLines =
        Array.isArray(focusGuidance) && focusGuidance.length > 0
          ? focusGuidance
          : [
              'Camera: specific movement (dolly in/out, crane up/down, handheld, static) + lens (35mm, 50mm, 85mm) + angle',
              'Lighting: direction, quality, color temperature (e.g., "soft window light from left, 3:1 contrast ratio")',
              'Subject detail: 2-3 specific visual characteristics',
              'Setting: precise location, time of day',
              'Style: film reference (shot on 35mm, cinematic, documentary-style)',
            ];

      const requirementLines = [
        `✓ ${minWords}-${maxWords} words`,
        `✓ ${sentenceRequirementLabel}`,
        '✓ Film terminology (not generic descriptions)',
        '✓ ONE clear action/focus per suggestion',
        '✓ Specific over generic ("weathered oak" not "nice table")',
        '✓ Flows with surrounding context',
        '✓ Do NOT mention or modify template section headings (Main Prompt, Technical Specs, Alternative Approaches)',
        '✓ Avoid meta instructions like "Consider" or "You could" — output only the replacement sentence',
        '✓ Respect the Video Prompt Template tone: cinematic, efficient, no filler language',
      ];

      extraRequirements.forEach((req) => {
        if (req && !requirementLines.includes(`✓ ${req}`)) {
          requirementLines.push(`✓ ${req}`);
        }
      });

      if (disallowTerminalPunctuation) {
        requirementLines.push('✓ No ending punctuation (noun phrase only)');
      }

      const slotLine = slotDescriptor
        ? `**Slot Role:** ${slotDescriptor}.`
        : `**Phrase Role:** ${resolvedPhraseRole} — replacements must serve the same grammatical role and slot cleanly into the existing sentence.`;

      const formLine = formRequirement ? `**Form Requirement:** ${formRequirement}.` : '';

      const lengthGuardrailLine =
        mode === 'micro'
          ? `**Length Guardrail:** ${minWords}-${maxWords} words, noun phrase drop-in replacement.`
          : `**Length Guardrail:** ${minWords}-${maxWords} words, ${
              maxSentences === 1 ? 'single sentence' : `${maxSentences} sentences max`
            }, drop-in replacement.`;

      const approachLines = [
        '- Keep enhancements scoped to the highlighted slot',
        '- Use film language: dolly, crane, rack focus, shallow DOF, 35mm, f/1.8',
        '- Prioritize ONE specific element per variant',
        '- Avoid multiple simultaneous actions',
      ];

      return `You are a video prompt expert for AI video generation (Sora, Veo3, RunwayML, Kling, Luma).${
        brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
      }

**APPROACH:**
${approachLines.join('\n')}

**HIGHLIGHTED SECTION:**
"${highlightedText}"

${slotLine}
**Original Length:** ${resolvedHighlightWordCount} words.
${lengthGuardrailLine}
${formLine ? `${formLine}\n` : ''}**CONTEXT:**
Before: "${contextBefore}"
After: "${contextAfter}"

**Your Task:**
Generate 3-5 enhanced alternatives. Each must be a complete drop-in replacement focusing on:

**Focus ONE per variant:**
${focusLines.map((line) => `- ${line}`).join('\n')}

**Requirements:**
${requirementLines.join('\n')}
${brainstormRequirementLine}
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "enhanced version...", "explanation": "Adds camera specifics..."},
  {"text": "alternative...", "explanation": "Different lighting approach..."},
  {"text": "third option...", "explanation": "Focuses on subject detail..."}
]`;
    }

    const brainstormContextReminder = brainstormSection
      ? '- Reinforce the Creative Brainstorm anchors detailed above.'
      : '';
    const brainstormQualityRequirement = brainstormSection
      ? '✓ Reinforces the Creative Brainstorm anchors above\n'
      : '';

    return `You are a prompt engineering expert specializing in clarity, specificity, and actionability.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }

<analysis_process>
Step 1: Analyze the highlighted section
- Content: "${highlightedText}"
- What is it trying to accomplish?
- Current clarity and specificity level

Step 2: Identify improvement opportunities
- Is it vague or ambiguous?
- Could it be more specific or concrete?
- Are there implicit requirements to make explicit?
- Would structure or examples help?

Step 3: Consider context
- Original intent: "${originalUserPrompt}"
- How does this fit in the full prompt?
- What constraints or requirements exist?
${brainstormContextReminder}

Step 4: Generate enhanced alternatives
- Create 3-5 variants with different improvement focuses
- Some add structure, some add examples, some add clarity
- Each should be a complete, self-contained replacement
- Maintain natural flow with surrounding context
</analysis_process>

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT:**
Before: "${contextBefore}"
After: "${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL REQUEST:**
"${originalUserPrompt}"

**Your Task:**
Generate 3-5 improved rewrites focusing on clarity and effectiveness.

**Improvement Strategies:**
- Add concrete examples or criteria
- Break down vague instructions into specific steps
- Specify formats or structures explicitly
- Add constraints or success criteria
- Make implicit requirements explicit
- Increase actionability and reduce ambiguity

**Quality Criteria:**
✓ Complete drop-in replacement
✓ Flows naturally with context
✓ More effective and specific than original
✓ Each variant takes different improvement approach
${brainstormQualityRequirement}✓ Maintains original intent and tone

Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "improved rewrite 1...", "explanation": "why this improvement works"},
  {"text": "alternative improvement 2...", "explanation": "why this improvement works"},
  {"text": "third approach 3...", "explanation": "why this improvement works"},
  {"text": "fourth variation 4...", "explanation": "why this improvement works"},
  {"text": "fifth option 5...", "explanation": "why this improvement works"}
]`;
  }

  /**
   * Construct a detailed brainstorm context section for prompts
   * @private
   */
  buildBrainstormContextSection(
    brainstormContext,
    { includeCategoryGuidance = false, isVideoPrompt = false } = {}
  ) {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return '';
    }

    const elements = brainstormContext.elements || {};
    const metadata = brainstormContext.metadata || {};

    const definedElements = Object.entries(elements).filter(([, value]) => {
      return typeof value === 'string' && value.trim().length > 0;
    });

    const technicalParams =
      metadata && typeof metadata.technicalParams === 'object'
        ? Object.entries(metadata.technicalParams).filter(([, value]) => {
            if (value === null || value === undefined) {
              return false;
            }
            if (typeof value === 'string') {
              return value.trim().length > 0;
            }
            if (Array.isArray(value)) {
              return value.length > 0;
            }
            if (typeof value === 'object') {
              return Object.keys(value).length > 0;
            }
            return true;
          })
        : [];

    const formatPreference =
      typeof metadata.format === 'string' && metadata.format.trim().length > 0
        ? metadata.format.trim()
        : null;

    const validationScore =
      typeof metadata.validationScore === 'number' &&
      Number.isFinite(metadata.validationScore)
        ? metadata.validationScore
        : null;

    if (!definedElements.length && !technicalParams.length && !formatPreference && validationScore === null) {
      return '';
    }

    let section = '**Creative Brainstorm Structured Context:**\n';
    section += 'These are user-confirmed anchors that suggestions must respect.\n';

    if (definedElements.length) {
      definedElements.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${value.trim()}\n`;
      });
    }

    if (formatPreference || technicalParams.length || validationScore !== null) {
      section += '\n**Metadata & Technical Guidance:**\n';

      if (formatPreference) {
        section += `- Format Preference: ${formatPreference}\n`;
      }

      if (validationScore !== null) {
        section += `- Validation Score: ${validationScore}\n`;
      }

      technicalParams.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${this.formatBrainstormValue(value)}\n`;
      });
    }

    if (includeCategoryGuidance) {
      section += '\nUse these anchors to inspire category labels and keep suggestions aligned with the user\'s core concept.\n';
    } else {
      section += '\nEnsure every rewrite strengthens these anchors rather than contradicting them.\n';
    }

    if (isVideoPrompt) {
      section += 'Translate these anchors into cinematic details whenever possible.\n';
    }

    return section;
  }

  /**
   * Format brainstorm keys into human-readable labels
   * @private
   */
  formatBrainstormKey(key) {
    if (!key) {
      return '';
    }

    return key
      .toString()
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Normalize brainstorm metadata values for prompt inclusion
   * @private
   */
  formatBrainstormValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Build prompt for custom suggestions
   * @private
   */
  buildCustomPrompt({
    highlightedText,
    customRequest,
    fullPrompt,
    isVideoPrompt,
  }) {
    return `You are a ${isVideoPrompt ? 'video prompt expert for AI video generation (Sora, Veo3, RunwayML)' : 'prompt engineering expert'} specializing in custom modifications.

<analysis_process>
Step 1: Understand the selected text
- Current content: "${highlightedText}"
- Role in overall prompt context

Step 2: Parse the user's modification request
- Request: "${customRequest}"
- Identify specific changes requested
- Determine intent: style change, detail addition, tone shift, restructuring, etc.

Step 3: Analyze contextual constraints
- How does this fit with surrounding prompt elements?
- ${isVideoPrompt ? 'What cinematic considerations apply?' : 'What tone and purpose must be maintained?'}

Step 4: Generate custom alternatives
- Create 3-5 variants that fulfill the user's request
- Each should interpret or implement the request differently
- Ensure drop-in compatibility with surrounding context
- Vary approaches to provide options
</analysis_process>

**Selected Text:**
"${highlightedText}"

**User's Modification Request:**
"${customRequest}"

**Full Prompt Context:**
${fullPrompt.substring(0, 1000)}

**Your Task:**
Generate 3-5 alternative rewrites that specifically implement the user's request.

**Requirements:**
✓ Complete drop-in replacement for selected text
✓ Directly addresses what the user asked for
✓ Flows naturally with surrounding context
✓ Each variant offers a meaningfully different approach
${isVideoPrompt ? '✓ Maintains compatibility with AI video platforms and includes cinematic detail' : '✓ Maintains overall prompt tone and purpose'}

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "first implementation of user's request..."},
  {"text": "second approach with different interpretation..."},
  {"text": "third variation with alternative take..."},
  {"text": "fourth option with unique spin..."},
  {"text": "fifth creative implementation..."}
]`;
  }

  /**
   * Group suggestions by their categories
   * @param {Array} suggestions - Array of suggestions with category field
   * @returns {Object} Grouped suggestions by category
   */
  groupSuggestionsByCategory(suggestions) {
    const grouped = {};

    suggestions.forEach(suggestion => {
      const category = suggestion.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(suggestion);
    });

    // Convert to array format for easier frontend handling
    return Object.entries(grouped).map(([category, items]) => ({
      category,
      suggestions: items
    }));
  }

  /**
   * Transfer style to text while maintaining meaning
   * @param {string} text - Original text
   * @param {string} targetStyle - Target style (technical, creative, academic, casual, formal)
   * @returns {Promise<string>} Text with transferred style
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

  /**
   * Ensure diversity in suggestions by checking similarity
   * @param {Array} suggestions - Array of suggestion objects
   * @returns {Promise<Array>} Filtered/regenerated diverse suggestions
   */
  async ensureDiverseSuggestions(suggestions) {
    if (!suggestions || suggestions.length <= 1) return suggestions;

    // Special handling for categorized suggestions
    if (suggestions[0]?.category) {
      return this.ensureCategoricalDiversity(suggestions);
    }

    // Calculate similarity matrix
    const similarities = [];
    for (let i = 0; i < suggestions.length; i++) {
      for (let j = i + 1; j < suggestions.length; j++) {
        const sim = await this.calculateSimilarity(
          suggestions[i].text,
          suggestions[j].text
        );
        similarities.push({ i, j, similarity: sim });
      }
    }

    // Find too-similar pairs (threshold: 0.7)
    const threshold = 0.7;
    const tooSimilar = similarities.filter(s => s.similarity > threshold);

    if (tooSimilar.length === 0) {
      return suggestions; // Already diverse
    }

    // Mark indices that need replacement
    const toReplace = new Set();
    tooSimilar.forEach(pair => {
      // Keep the first, replace the second
      toReplace.add(pair.j);
    });

    // Generate replacements for similar suggestions
    const diverseSuggestions = [...suggestions];
    for (const idx of toReplace) {
      diverseSuggestions[idx] = await this.generateDiverseAlternative(
        suggestions,
        idx
      );
    }

    logger.info('Enforced diversity', {
      original: suggestions.length,
      replaced: toReplace.size,
    });

    return diverseSuggestions;
  }

  /**
   * Ensure diversity across categories
   * @private
   */
  ensureCategoricalDiversity(suggestions) {
    // Group by category
    const categoryCounts = {};
    suggestions.forEach(s => {
      const cat = s.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Check if any category is over-represented (more than 40% of suggestions)
    const totalSuggestions = suggestions.length;
    const maxPerCategory = Math.ceil(totalSuggestions * 0.4);

    let needsRebalancing = false;
    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count > maxPerCategory) {
        logger.info('Category over-represented', { category, count, max: maxPerCategory });
        needsRebalancing = true;
        break;
      }
    }

    if (!needsRebalancing) {
      return suggestions; // Already balanced
    }

    // Rebalance by limiting each category
    const balanced = [];
    const categoryLimits = {};

    // First pass: take up to max from each category
    suggestions.forEach(suggestion => {
      const cat = suggestion.category || 'Other';
      if (!categoryLimits[cat]) categoryLimits[cat] = 0;

      if (categoryLimits[cat] < maxPerCategory) {
        balanced.push(suggestion);
        categoryLimits[cat]++;
      }
    });

    // Ensure we have enough diversity in categories
    const uniqueCategories = Object.keys(categoryCounts);
    if (uniqueCategories.length < 3 && totalSuggestions >= 6) {
      logger.warn('Not enough category diversity', {
        categories: uniqueCategories.length,
        suggestions: totalSuggestions
      });
    }

    return balanced;
  }

  /**
   * Calculate similarity between two texts
   * @private
   */
  async calculateSimilarity(text1, text2) {
    // Simple character-level similarity (Jaccard)
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    // Also check for substring containment
    const substringPenalty =
      text1.includes(text2) || text2.includes(text1) ? 0.3 : 0;

    return intersection.size / union.size + substringPenalty;
  }

  /**
   * Generate a diverse alternative to replace a similar suggestion
   * @private
   */
  async generateDiverseAlternative(suggestions, indexToReplace) {
    const original = suggestions[indexToReplace];
    const otherSuggestions = suggestions.filter((_, i) => i !== indexToReplace);

    const diversityPrompt = `Generate a diverse alternative that is meaningfully different from the existing suggestions.

Original suggestion to replace: "${original.text}"

Existing suggestions to differ from:
${otherSuggestions.map((s, i) => `${i + 1}. "${s.text}"`).join('\n')}

Requirements:
1. Must serve the same purpose as the original
2. Must be meaningfully different in approach or style
3. Should explore a different angle or perspective
4. Maintain quality and relevance

Provide a JSON object with the new suggestion:
{"text": "your diverse alternative", "explanation": "why this is different"}`;

    try {
      const response = await this.claudeClient.complete(diversityPrompt, {
        maxTokens: 256,
        temperature: 0.9, // Higher temperature for diversity
      });

      const alternative = JSON.parse(response.content[0].text);
      return alternative;
    } catch (error) {
      logger.warn('Failed to generate diverse alternative', { error });
      // Fallback: return original with slight modification
      return {
        text: original.text + ' (alternative approach)',
        explanation: original.explanation || 'Alternative variation',
      };
    }
  }

  /**
   * Generate ensemble suggestions using multiple approaches
   * @param {Object} params - Generation parameters
   * @returns {Promise<Array>} Combined and ranked suggestions
   */
  async generateEnsembleSuggestions({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
  }) {
    logger.info('Generating ensemble suggestions');

    // Generate suggestions using different approaches in parallel
    const approaches = await Promise.all([
      this.generateWithHighTemperature({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
      }),
      this.generateWithExamples({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
      }),
      this.generateWithConstraints({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
      }),
      this.generateWithReasoning({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
      }),
    ]);

    // Combine all suggestions
    const combined = approaches.flat();

    // Remove duplicates and rank
    const unique = this.removeDuplicates(combined);
    const ranked = await this.rankByCriteria(unique, {
      diversity: 0.3,
      quality: 0.4,
      relevance: 0.3,
    });

    return ranked.slice(0, 8); // Return top 8
  }

  /**
   * Detect the likely role of a highlighted phrase within a video prompt
   * @private
   */
  detectVideoPhraseRole(highlightedText, contextBefore, contextAfter, explicitCategory) {
    const text = highlightedText?.trim() || '';
    const normalizedCategory = explicitCategory
      ? explicitCategory.toLowerCase()
      : '';

    const mapCategory = (category) => {
      if (!category) {
        return null;
      }

      if (/subject|character|figure|talent|person|performer/.test(category)) {
        return 'subject or character detail';
      }

      if (/light|lighting|illumination|shadow/.test(category)) {
        return 'lighting description';
      }

      if (/camera|framing|shot|lens/.test(category)) {
        return 'camera or framing description';
      }

      if (/location|setting|environment|background|place/.test(category)) {
        return 'location or environment detail';
      }

      if (/style|tone|aesthetic|mood|genre/.test(category)) {
        return 'style or tone descriptor';
      }

      if (/audio|music|sound|score/.test(category)) {
        return 'audio or score descriptor';
      }

      return null;
    };

    const categoryRole = mapCategory(normalizedCategory);
    if (categoryRole) {
      return categoryRole;
    }

    if (!text) {
      return 'general visual detail';
    }

    const combinedContext = `${contextBefore || ''} ${contextAfter || ''}`.toLowerCase();

    const contextRole = mapCategory(combinedContext);
    if (contextRole) {
      return contextRole;
    }

    if (/\b(location|setting|background|environment|interior|exterior|room|space|chamber|landscape|street)\b/.test(combinedContext)) {
      return 'location or environment detail';
    }

    if (/\b(camera|shot|angle|frame|lens|dolly|pan|tilt|tracking|handheld|static)\b/.test(combinedContext)) {
      return 'camera or framing description';
    }

    if (/\b(light|lighting|illuminated|glow|shadow|contrast|exposure|flare)\b/.test(combinedContext)) {
      return 'lighting description';
    }

    if (/\bcharacter|figure|subject|person|leader|speaker|performer|actor|portrait\b/.test(combinedContext)) {
      return 'subject or character detail';
    }

    if (/\bstyle|aesthetic|tone|mood|vibe|genre|inspired\b/.test(combinedContext)) {
      return 'style or tone descriptor';
    }

    if (/\bscore|music|soundtrack|audio\b/.test(combinedContext)) {
      return 'audio or score descriptor';
    }

    return 'general visual detail';
  }

  /**
   * Count words in a string
   * @private
   */
  countWords(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    return text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  /**
   * Resolve video replacement constraints based on highlight context
   * @private
   */
  getVideoReplacementConstraints(details = {}, options = {}) {
    const {
      highlightWordCount = 0,
      phraseRole,
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence,
    } = details;
    const { forceMode } = options;

    const trimmedText = (highlightedText || '').trim();
    const normalizedRole = (phraseRole || '').toLowerCase();
    const normalizedCategory = (highlightedCategory || '').toLowerCase();
    const highlightWordCountSafe = Number.isFinite(highlightWordCount)
      ? Math.max(0, Math.floor(highlightWordCount))
      : 0;
    const highlightIsSentence =
      /[.!?]$/.test(trimmedText) || highlightWordCountSafe >= 12;

    const categoryIsReliable =
      highlightedCategoryConfidence === undefined ||
      highlightedCategoryConfidence === null ||
      !Number.isFinite(highlightedCategoryConfidence)
        ? true
        : highlightedCategoryConfidence >= 0.45;

    const trustedCategory =
      highlightedCategory && categoryIsReliable ? normalizedCategory : '';
    const categorySource = trustedCategory || normalizedRole;

    const slotDescriptor =
      phraseRole ||
      (highlightedCategory ? `${highlightedCategory} detail` : 'visual detail');

    const ensureBounds = (min, max) => {
      const lower = Math.max(1, Math.round(min));
      const upper = Math.max(lower, Math.round(max));
      return { min: lower, max: upper };
    };

    const buildConstraint = (config) => {
      const bounds = ensureBounds(config.minWords, config.maxWords);
      return {
        ...config,
        minWords: bounds.min,
        maxWords: bounds.max,
        maxSentences: config.maxSentences ?? 1,
        slotDescriptor,
      };
    };

    const micro = () =>
      buildConstraint({
        mode: 'micro',
        minWords: Math.max(2, Math.min(3, highlightWordCountSafe + 1)),
        maxWords: Math.min(6, Math.max(4, highlightWordCountSafe + 2)),
        maxSentences: 1,
        disallowTerminalPunctuation: true,
        formRequirement: '2-6 word cinematic noun phrase describing the same subject',
        focusGuidance: [
          'Use precise visual modifiers (wardrobe, era, material)',
          'Avoid verbs; keep the replacement as a noun phrase',
        ],
        extraRequirements: ['Keep it a noun phrase (no verbs)'],
      });

    const lighting = () =>
      buildConstraint({
        mode: 'lighting',
        minWords: Math.max(6, Math.min(8, highlightWordCountSafe + 1)),
        maxWords: Math.min(14, Math.max(9, highlightWordCountSafe + 4)),
        maxSentences: 1,
        formRequirement:
          'Single lighting clause covering source, direction, and color temperature',
        focusGuidance: [
          'Name the light source and direction',
          'Include color temperature or mood language',
        ],
        extraRequirements: ['Mention light source + direction', 'Reference color temperature or mood'],
      });

    const camera = () =>
      buildConstraint({
        mode: 'camera',
        minWords: Math.max(6, Math.min(8, highlightWordCountSafe + 1)),
        maxWords: Math.min(12, Math.max(9, highlightWordCountSafe + 3)),
        maxSentences: 1,
        formRequirement:
          'Single movement clause combining camera move, lens, and framing',
        focusGuidance: [
          'Pair a camera move with a lens choice and framing detail',
          'Stay in the same tense and perspective as the template',
        ],
        extraRequirements: ['Include a lens or focal length', 'Reference camera movement'],
      });

    const location = () =>
      buildConstraint({
        mode: 'location',
        minWords: Math.max(6, Math.min(8, highlightWordCountSafe + 1)),
        maxWords: Math.min(14, Math.max(9, highlightWordCountSafe + 4)),
        maxSentences: 1,
        formRequirement: 'Concise location beat with time-of-day or atmosphere',
        focusGuidance: [
          'Anchor the setting with sensory specifics',
          'Mention time of day or atmospheric detail',
        ],
        extraRequirements: ['Include a sensory or atmospheric hook'],
      });

    const style = () =>
      buildConstraint({
        mode: 'style',
        minWords: Math.max(5, Math.min(7, highlightWordCountSafe + 1)),
        maxWords: Math.min(12, Math.max(8, highlightWordCountSafe + 3)),
        maxSentences: 1,
        formRequirement: 'Compact stylistic phrase referencing medium, era, or tone',
        focusGuidance: [
          'Reference a medium, era, or artistic influence',
          'Keep it tightly scoped to the highlighted span',
        ],
        extraRequirements: [],
      });

    const phrase = () =>
      buildConstraint({
        mode: 'phrase',
        minWords: Math.max(5, Math.min(7, highlightWordCountSafe + 1)),
        maxWords: Math.min(12, Math.max(8, highlightWordCountSafe + 3)),
        maxSentences: 1,
        formRequirement: 'Single cinematic clause focused on one production choice',
        focusGuidance: [
          'Emphasize one production detail (camera, lighting, subject, or location)',
          'Avoid expanding beyond the surrounding sentence',
        ],
        extraRequirements: [],
      });

    const sentence = () =>
      buildConstraint({
        mode: 'sentence',
        minWords: Math.max(10, Math.min(12, highlightWordCountSafe + 2)),
        maxWords: Math.min(25, Math.max(14, highlightWordCountSafe + 6)),
        maxSentences: 1,
        formRequirement: 'Single cinematic sentence that flows with the template',
        focusGuidance: [
          'Lead with the most important cinematic detail',
          'Keep it punchy—no compound sentences',
        ],
        extraRequirements: [],
      });

    if (forceMode === 'micro') {
      return micro();
    }
    if (forceMode === 'phrase') {
      return phrase();
    }
    if (forceMode === 'sentence') {
      return sentence();
    }
    if (forceMode === 'lighting') {
      return lighting();
    }
    if (forceMode === 'camera') {
      return camera();
    }
    if (forceMode === 'location') {
      return location();
    }
    if (forceMode === 'style') {
      return style();
    }

    const isSubject =
      categorySource.includes('subject') || categorySource.includes('character');
    const isLighting = categorySource.includes('lighting');
    const isCamera =
      categorySource.includes('camera') ||
      categorySource.includes('framing') ||
      categorySource.includes('shot');
    const isLocation =
      categorySource.includes('location') ||
      categorySource.includes('environment') ||
      categorySource.includes('setting');
    const isStyle =
      categorySource.includes('style') ||
      categorySource.includes('tone') ||
      categorySource.includes('aesthetic');
    const isAudio = categorySource.includes('audio') || categorySource.includes('score');
    const highlightIsVeryShort = highlightWordCountSafe <= 3;

    if (isSubject || highlightIsVeryShort) {
      return micro();
    }

    if (isLighting) {
      return lighting();
    }

    if (isCamera) {
      return camera();
    }

    if (isLocation) {
      return location();
    }

    if (isStyle || isAudio) {
      return style();
    }

    if (!highlightIsSentence && highlightWordCountSafe <= 8) {
      return phrase();
    }

    return sentence();
  }

  /**
   * Determine the next fallback constraint mode to try
   * @private
   */
  getVideoFallbackConstraints(
    currentConstraints,
    details = {},
    attemptedModes = new Set()
  ) {
    const fallbackOrder = [];

    if (!currentConstraints) {
      fallbackOrder.push('phrase', 'micro');
    } else if (currentConstraints.mode === 'sentence') {
      fallbackOrder.push('phrase', 'micro');
    } else if (currentConstraints.mode === 'phrase') {
      fallbackOrder.push('micro');
    } else if (
      currentConstraints.mode === 'lighting' ||
      currentConstraints.mode === 'camera' ||
      currentConstraints.mode === 'location' ||
      currentConstraints.mode === 'style'
    ) {
      fallbackOrder.push('micro');
    }

    for (const mode of fallbackOrder) {
      if (attemptedModes.has(mode)) {
        continue;
      }

      return this.getVideoReplacementConstraints(details, { forceMode: mode });
    }

    return null;
  }

  /**
   * Sanitize suggestions to ensure they are valid drop-in replacements
   * @private
   */
  sanitizeSuggestions(
    suggestions,
    { highlightedText, isPlaceholder, isVideoPrompt, videoConstraints }
  ) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return [];
    }

    const sanitized = [];
    const normalizedHighlight = highlightedText?.trim().toLowerCase();
    const disallowedTemplatePatterns = [
      /\bmain prompt\b/i,
      /\btechnical specs?\b/i,
      /\balternative approaches\b/i,
    ];
    const disallowedPrefixes = [
      'consider',
      'try',
      'maybe',
      'you could',
      'focus on',
      'rewrite',
      'update',
      'suggest',
      'recommend',
    ];

    suggestions.forEach((suggestion) => {
      if (!suggestion) {
        return;
      }

      const suggestionObj =
        typeof suggestion === 'string'
          ? { text: suggestion, explanation: '' }
          : { ...suggestion };

      if (typeof suggestionObj.text !== 'string') {
        return;
      }

      let text = suggestionObj.text.replace(/^[0-9]+\.\s*/, '');
      text = text.replace(/\s+/g, ' ').trim();

      if (!text) {
        return;
      }

      if (normalizedHighlight && text.toLowerCase() === normalizedHighlight) {
        return; // identical to highlight, no improvement
      }

      if (/\r|\n/.test(text)) {
        return; // multi-line response is not a drop-in replacement
      }

      if (disallowedTemplatePatterns.some((pattern) => pattern.test(text))) {
        return;
      }

      const lowerText = text.toLowerCase();
      if (disallowedPrefixes.some((prefix) => lowerText.startsWith(prefix))) {
        return;
      }

      const wordCount = this.countWords(text);

      if (isPlaceholder) {
        if (wordCount === 0 || wordCount > 4) {
          return;
        }

        if (/[.!?]/.test(text)) {
          return;
        }
      } else if (isVideoPrompt) {
        const constraints = videoConstraints || {
          minWords: 10,
          maxWords: 25,
          maxSentences: 1,
        };

        const minWords = Number.isFinite(constraints.minWords)
          ? constraints.minWords
          : 10;
        const maxWords = Number.isFinite(constraints.maxWords)
          ? constraints.maxWords
          : 25;
        const maxSentences = Number.isFinite(constraints.maxSentences)
          ? constraints.maxSentences
          : 1;

        if (wordCount < minWords || wordCount > maxWords) {
          return;
        }

        const sentenceCount = (text.match(/[.!?]/g) || []).length;
        if (maxSentences > 0 && sentenceCount > maxSentences) {
          return;
        }

        if (constraints.disallowTerminalPunctuation && /[.!?]$/.test(text)) {
          return;
        }

        if (constraints.mode === 'micro') {
          if (/[.!?]/.test(text)) {
            return;
          }

          if (/[,:;]/.test(text)) {
            return;
          }

          if (/\b(is|are|was|were|be|being|been|am)\b/i.test(lowerText)) {
            return;
          }
        }

        if (/\b(prompt|section|paragraph|rewrite|entire|overall)\b/i.test(text)) {
          return;
        }
      }

      sanitized.push({
        ...suggestionObj,
        text,
      });
    });

    return sanitized;
  }

  /**
   * Generate suggestions with high temperature for creativity
   * @private
   */
  async generateWithHighTemperature(params) {
    const prompt = this.buildRewritePrompt(params);

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 1024,
        temperature: 0.95,
      });

      return JSON.parse(response.content[0].text);
    } catch {
      return [];
    }
  }

  /**
   * Generate suggestions with examples for guidance
   * @private
   */
  async generateWithExamples(params) {
    const examplePrompt = `${this.buildRewritePrompt(params)}

Here are excellent examples of similar enhancements:
1. Original: "make it better" → Enhanced: "optimize for performance, readability, and maintainability"
2. Original: "add some features" → Enhanced: "implement user authentication, data validation, and error handling"

Follow the pattern of being specific and actionable.`;

    try {
      const response = await this.claudeClient.complete(examplePrompt, {
        maxTokens: 1024,
        temperature: 0.7,
      });

      return JSON.parse(response.content[0].text);
    } catch {
      return [];
    }
  }

  /**
   * Generate suggestions with specific constraints
   * @private
   */
  async generateWithConstraints(params) {
    const constraintPrompt = `${this.buildRewritePrompt(params)}

Additional constraints:
- Each suggestion must be 20-50% longer than the original
- Use active voice and strong verbs
- Include specific metrics or criteria when possible
- Avoid generic terms`;

    try {
      const response = await this.claudeClient.complete(constraintPrompt, {
        maxTokens: 1024,
        temperature: 0.6,
      });

      return JSON.parse(response.content[0].text);
    } catch {
      return [];
    }
  }

  /**
   * Generate suggestions with reasoning
   * @private
   */
  async generateWithReasoning(params) {
    const reasoningPrompt = `First, analyze what makes the highlighted text unclear or improvable.

Highlighted: "${params.highlightedText}"
Context: "${params.contextBefore}[HIGHLIGHT]${params.contextAfter}"

Issues to address:
1. Vagueness or ambiguity
2. Missing specifics
3. Unclear structure
4. Implicit assumptions

Now generate improvements that specifically address these issues.

${this.buildRewritePrompt(params)}`;

    try {
      const response = await this.claudeClient.complete(reasoningPrompt, {
        maxTokens: 1024,
        temperature: 0.5,
      });

      // Extract JSON from response (may include reasoning)
      const jsonMatch = response.content[0].text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Remove duplicate suggestions
   * @private
   */
  removeDuplicates(suggestions) {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      const key = suggestion.text.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Rank suggestions by multiple criteria
   * @private
   */
  async rankByCriteria(suggestions, weights) {
    // Simple scoring based on heuristics
    const scoredSuggestions = suggestions.map(suggestion => {
      const scores = {
        diversity: this.scoreDiversity(suggestion, suggestions),
        quality: this.scoreQuality(suggestion),
        relevance: this.scoreRelevance(suggestion),
      };

      const totalScore =
        scores.diversity * weights.diversity +
        scores.quality * weights.quality +
        scores.relevance * weights.relevance;

      return {
        ...suggestion,
        score: totalScore,
      };
    });

    return scoredSuggestions.sort((a, b) => b.score - a.score);
  }

  /**
   * Score suggestion diversity
   * @private
   */
  scoreDiversity(suggestion, allSuggestions) {
    // Higher score for unique words not in other suggestions
    const words = new Set(suggestion.text.toLowerCase().split(/\s+/));
    let uniqueCount = 0;

    words.forEach(word => {
      let isUnique = true;
      allSuggestions.forEach(other => {
        if (other !== suggestion && other.text.toLowerCase().includes(word)) {
          isUnique = false;
        }
      });
      if (isUnique) uniqueCount++;
    });

    return Math.min(uniqueCount / words.size, 1);
  }

  /**
   * Score suggestion quality
   * @private
   */
  scoreQuality(suggestion) {
    let score = 0;

    // Length (not too short, not too long)
    const length = suggestion.text.length;
    if (length > 20 && length < 200) score += 0.3;

    // Has explanation
    if (suggestion.explanation && suggestion.explanation.length > 20) score += 0.3;

    // Contains specific terms (not vague)
    const specificTerms = ['specifically', 'exactly', 'must', 'should', 'criteria'];
    specificTerms.forEach(term => {
      if (suggestion.text.toLowerCase().includes(term)) score += 0.1;
    });

    return Math.min(score, 1);
  }

  /**
   * Score suggestion relevance
   * @private
   */
  scoreRelevance(suggestion) {
    // Basic heuristic: longer explanations often indicate better understanding
    const explanationScore = suggestion.explanation
      ? Math.min(suggestion.explanation.length / 100, 0.5)
      : 0;

    // Contains action words
    const actionWords = ['create', 'implement', 'build', 'design', 'develop', 'analyze'];
    let actionScore = 0;
    actionWords.forEach(word => {
      if (suggestion.text.toLowerCase().includes(word)) actionScore += 0.1;
    });

    return Math.min(explanationScore + actionScore, 1);
  }
}
