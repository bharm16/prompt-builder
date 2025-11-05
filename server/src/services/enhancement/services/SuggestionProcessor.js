import { logger } from '../../../infrastructure/Logger.js';
import { detectDescriptorCategory, getCategoryFallbacks } from '../../DescriptorCategories.js';

/**
 * Service responsible for processing and finalizing suggestions
 * Handles descriptor fallbacks, grouping, and result formatting
 */
export class SuggestionProcessor {
  constructor(validationService) {
    this.validationService = validationService;
  }

  /**
   * Apply descriptor fallbacks if needed
   * @param {Array} suggestions - Current suggestions
   * @param {string} highlightedText - Highlighted text
   * @returns {Object} Processed suggestions with metadata
   */
  applyDescriptorFallbacks(suggestions, highlightedText) {
    if (suggestions.length > 0) {
      return {
        suggestions,
        usedFallback: false,
        isDescriptorPhrase: false,
      };
    }

    // Detect if this is a descriptor-type phrase
    const descriptorDetection = detectDescriptorCategory(highlightedText);
    const isDescriptorPhrase = descriptorDetection.confidence > 0.4;

    logger.debug('Descriptor detection', {
      isDescriptorPhrase,
      category: descriptorDetection.category,
      confidence: descriptorDetection.confidence,
    });

    if (!isDescriptorPhrase || !descriptorDetection.category) {
      return {
        suggestions: [],
        usedFallback: false,
        isDescriptorPhrase,
      };
    }

    // Try descriptor category fallbacks
    const descriptorFallbacks = getCategoryFallbacks(descriptorDetection.category);
    
    if (descriptorFallbacks.length > 0) {
      logger.info('Using descriptor category fallbacks', {
        category: descriptorDetection.category,
        count: descriptorFallbacks.length,
      });
      
      return {
        suggestions: descriptorFallbacks,
        usedFallback: true,
        isDescriptorPhrase,
        descriptorCategory: descriptorDetection.category,
      };
    }

    return {
      suggestions: [],
      usedFallback: false,
      isDescriptorPhrase,
    };
  }

  /**
   * Group suggestions by category if applicable
   * @param {Array} suggestions - Suggestions to group
   * @param {boolean} isPlaceholder - Whether suggestions are for placeholder
   * @returns {Array} Grouped or ungrouped suggestions
   */
  groupSuggestions(suggestions, isPlaceholder) {
    if (isPlaceholder && suggestions[0]?.category) {
      return this.validationService.groupSuggestionsByCategory(suggestions);
    }
    return suggestions;
  }

  /**
   * Build final result object
   * @param {Object} params - Result parameters
   * @returns {Object} Final result object
   */
  buildResult({
    groupedSuggestions,
    isPlaceholder,
    phraseRole,
    activeConstraints,
    alignmentFallbackApplied,
    usedFallback,
    hasNoSuggestions,
  }) {
    const result = {
      suggestions: groupedSuggestions,
      isPlaceholder,
      hasCategories: isPlaceholder && groupedSuggestions[0]?.category ? true : false,
      phraseRole: phraseRole || null,
      appliedConstraintMode: activeConstraints?.mode || null,
      fallbackApplied: alignmentFallbackApplied || usedFallback,
    };

    if (activeConstraints) {
      result.appliedVideoConstraints = activeConstraints;
    }

    if (hasNoSuggestions) {
      result.noSuggestionsReason =
        'No template-compliant drop-in replacements were generated for this highlight.';
    }

    return result;
  }

  /**
   * Log result metadata
   * @param {Object} result - Result object
   * @param {Array} sanitizedSuggestions - Original sanitized suggestions
   * @param {boolean} usedFallback - Whether fallback was used
   * @param {number} fallbackSourceCount - Count from fallback source
   * @param {Array} baseSuggestions - Base suggestions array
   */
  logResult(result, sanitizedSuggestions, usedFallback, fallbackSourceCount, baseSuggestions) {
    const groupedSuggestions = result.suggestions;

    logger.info('Final result structure', {
      isGrouped:
        Array.isArray(groupedSuggestions) &&
        groupedSuggestions[0]?.suggestions !== undefined,
      categoriesCount: groupedSuggestions[0]?.suggestions ? groupedSuggestions.length : 0,
      hasCategories: result.hasCategories,
      appliedConstraintMode: result.appliedConstraintMode || null,
    });

    let baseSuggestionCount;
    if (usedFallback) {
      baseSuggestionCount = fallbackSourceCount;
    } else if (Array.isArray(baseSuggestions)) {
      baseSuggestionCount = baseSuggestions.length;
    } else {
      baseSuggestionCount = 0;
    }

    logger.info('Enhancement suggestions generated', {
      count: sanitizedSuggestions.length,
      type: result.isPlaceholder ? 'placeholder' : 'rewrite',
      diversityEnforced: sanitizedSuggestions.length !== baseSuggestionCount,
      appliedConstraintMode: result.appliedConstraintMode || null,
      usedFallback,
    });
  }
}

