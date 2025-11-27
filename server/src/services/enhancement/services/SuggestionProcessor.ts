import { logger } from '@infrastructure/Logger';
import { detectDescriptorCategory, getCategoryFallbacks } from '../../video-concept/config/descriptorCategories.js';
import type { Suggestion, GroupedSuggestions, EnhancementResult, DescriptorFallbackResult } from './types.js';

/**
 * Interface for validation service
 */
interface ValidationService {
  groupSuggestionsByCategory(suggestions: Suggestion[]): GroupedSuggestions[];
}

/**
 * Service responsible for processing and finalizing suggestions
 * Handles descriptor fallbacks, grouping, and result formatting
 */
export class SuggestionProcessor {
  constructor(private readonly validationService: ValidationService) {}

  /**
   * Apply descriptor fallbacks if needed
   * @param suggestions - Current suggestions
   * @param highlightedText - Highlighted text
   * @returns Processed suggestions with metadata
   */
  applyDescriptorFallbacks(suggestions: Suggestion[], highlightedText: string): DescriptorFallbackResult {
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
        suggestions: descriptorFallbacks as Suggestion[],
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
   * @param suggestions - Suggestions to group
   * @param isPlaceholder - Whether suggestions are for placeholder
   * @returns Grouped or ungrouped suggestions
   */
  groupSuggestions(suggestions: Suggestion[], isPlaceholder: boolean): Suggestion[] | GroupedSuggestions[] {
    if (isPlaceholder && suggestions[0]?.category) {
      return this.validationService.groupSuggestionsByCategory(suggestions);
    }
    return suggestions;
  }

  /**
   * Build final result object
   * @param params - Result parameters
   * @returns Final result object
   */
  buildResult({
    groupedSuggestions,
    isPlaceholder,
    phraseRole,
    activeConstraints,
    alignmentFallbackApplied,
    usedFallback,
    hasNoSuggestions,
  }: {
    groupedSuggestions: Suggestion[] | GroupedSuggestions[];
    isPlaceholder: boolean;
    phraseRole?: string | null;
    activeConstraints?: { mode?: string } | null;
    alignmentFallbackApplied?: boolean;
    usedFallback?: boolean;
    hasNoSuggestions?: boolean;
  }): EnhancementResult {
    const result: EnhancementResult = {
      suggestions: groupedSuggestions,
      isPlaceholder,
      hasCategories: isPlaceholder && Array.isArray(groupedSuggestions) && groupedSuggestions[0] && 'suggestions' in groupedSuggestions[0] ? true : false,
      phraseRole: phraseRole || null,
      appliedConstraintMode: activeConstraints?.mode || null,
      fallbackApplied: alignmentFallbackApplied || usedFallback || false,
    };

    if (activeConstraints) {
      result.appliedVideoConstraints = activeConstraints as { mode?: string; [key: string]: unknown };
    }

    if (hasNoSuggestions) {
      result.noSuggestionsReason =
        'No template-compliant drop-in replacements were generated for this highlight.';
    }

    return result;
  }

  /**
   * Log result metadata
   * @param result - Result object
   * @param sanitizedSuggestions - Original sanitized suggestions
   * @param usedFallback - Whether fallback was used
   * @param fallbackSourceCount - Count from fallback source
   * @param baseSuggestions - Base suggestions array
   */
  logResult(
    result: EnhancementResult,
    sanitizedSuggestions: Suggestion[],
    usedFallback: boolean,
    fallbackSourceCount: number,
    baseSuggestions: Suggestion[]
  ): void {
    const groupedSuggestions = result.suggestions;

    logger.info('Final result structure', {
      isGrouped:
        Array.isArray(groupedSuggestions) &&
        groupedSuggestions[0] &&
        'suggestions' in groupedSuggestions[0],
      categoriesCount: Array.isArray(groupedSuggestions) && groupedSuggestions[0] && 'suggestions' in groupedSuggestions[0] ? groupedSuggestions.length : 0,
      hasCategories: result.hasCategories,
      appliedConstraintMode: result.appliedConstraintMode || null,
    });

    let baseSuggestionCount: number;
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

