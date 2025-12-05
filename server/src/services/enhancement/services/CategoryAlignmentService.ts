import { logger } from '@infrastructure/Logger';
import { CATEGORY_CONSTRAINTS, detectSubcategory } from '../config/CategoryConstraints.js';
import type { Suggestion, ValidationParams, CategoryAlignmentResult } from './types.js';

/**
 * Interface for validation service
 */
interface ValidationService {
  validateSuggestions(suggestions: Suggestion[], highlightedText: string, category: string): Suggestion[];
}

/**
 * CategoryAlignmentService
 *
 * Responsible for enforcing category alignment and providing fallback suggestions.
 * Ensures suggestions match the expected category and provides alternatives when needed.
 *
 * Single Responsibility: Category validation and fallback management
 */
export class CategoryAlignmentService {
  private readonly log = logger.child({ service: 'CategoryAlignmentService' });

  constructor(private readonly validationService: ValidationService) {}

  /**
   * Enforce category alignment for suggestions
   * Validates suggestions match the category or provides fallbacks
   * @param suggestions - Array of suggestions to validate
   * @param params - Validation parameters
   * @returns Result with suggestions and metadata
   */
  enforceCategoryAlignment(suggestions: Suggestion[], params: ValidationParams): CategoryAlignmentResult {
    const operation = 'enforceCategoryAlignment';
    const { highlightedText, highlightedCategory } = params;

    this.log.debug('Enforcing category alignment', {
      operation,
      suggestionCount: suggestions.length,
      category: highlightedCategory || null,
    });

    // Check if we need fallbacks
    const needsFallback = this.shouldUseFallback(suggestions, highlightedText, highlightedCategory);

    if (needsFallback) {
      this.log.warn('Fallback required due to category mismatch or low confidence', {
        operation,
        originalSuggestionCount: suggestions.length,
        category: highlightedCategory || null,
      });
      
      const fallbacks = this.getCategoryFallbacks(highlightedText, highlightedCategory);
      
      this.log.info('Fallback suggestions applied', {
        operation,
        fallbackCount: fallbacks.length,
        category: highlightedCategory || null,
      });
      
      return {
        suggestions: fallbacks,
        fallbackApplied: true,
        context: {
          baseCategory: highlightedCategory || undefined,
          originalSuggestionsRejected: suggestions.length,
          reason: 'Category mismatch or low confidence'
        }
      };
    }

    // Validate and filter suggestions
    const validSuggestions = this.validationService.validateSuggestions(
      suggestions,
      highlightedText,
      highlightedCategory || ''
    );

    this.log.info('Category alignment completed', {
      operation,
      originalCount: suggestions.length,
      validCount: validSuggestions.length,
      category: highlightedCategory || null,
      fallbackApplied: false,
    });

    return {
      suggestions: validSuggestions,
      fallbackApplied: false,
      context: { baseCategory: highlightedCategory || undefined }
    };
  }

  /**
   * Determine if fallback suggestions should be used
   * Checks for category mismatches and quality issues
   * @param suggestions - Suggestions to validate
   * @param highlightedText - Original text
   * @param category - Expected category
   * @returns True if fallbacks should be used
   */
  shouldUseFallback(suggestions: Suggestion[], highlightedText: string, category?: string): boolean {
    const operation = 'shouldUseFallback';
    
    // Use fallback if no suggestions or very low count
    if (!suggestions || suggestions.length < 2) {
      this.log.debug('Fallback needed: insufficient suggestions', {
        operation,
        suggestionCount: suggestions?.length || 0,
      });
      return true;
    }

    if (!category) {
      this.log.debug('No category specified, fallback not needed', { operation });
      return false;
    }

    // Check for category mismatches
    if (category === 'technical' && CATEGORY_CONSTRAINTS.technical) {
      const subcategory = detectSubcategory(highlightedText, category);
      if (subcategory) {
        const constraint = CATEGORY_CONSTRAINTS.technical[subcategory as keyof typeof CATEGORY_CONSTRAINTS.technical];
        if (constraint && 'pattern' in constraint && constraint.pattern instanceof RegExp) {
          const validCount = suggestions.filter(s =>
            constraint.pattern.test(s.text)
          ).length;
          const needsFallback = validCount < suggestions.length * 0.5;
          
          if (needsFallback) {
            this.log.warn('Category mismatch detected in technical subcategory', {
              operation,
              subcategory,
              validCount,
              totalCount: suggestions.length,
              validRatio: validCount / suggestions.length,
            });
          }
          
          return needsFallback;
        }
      }
    }

    // Check for audio suggestions in non-audio categories
    if (['technical', 'framing', 'descriptive'].includes(category)) {
      const audioCount = suggestions.filter(s =>
        /audio|sound|music|score/i.test(s.text) ||
        (s.category && s.category.toLowerCase().includes('audio'))
      ).length;
      if (audioCount > 0) {
        this.log.warn('Audio suggestions detected in non-audio category', {
          operation,
          category,
          audioCount,
          totalCount: suggestions.length,
        });
        return true;
      }
    }

    // Check for lighting suggestions in style descriptors
    if (category === 'descriptive') {
      const lightingCount = suggestions.filter(s =>
        /light|shadow|glow|illuminat/i.test(s.text) ||
        (s.category && s.category.toLowerCase().includes('light'))
      ).length;
      const needsFallback = lightingCount > suggestions.length * 0.5;
      
      if (needsFallback) {
        this.log.warn('Lighting suggestions detected in descriptive category', {
          operation,
          lightingCount,
          totalCount: suggestions.length,
          lightingRatio: lightingCount / suggestions.length,
        });
      }
      
      return needsFallback;
    }

    this.log.debug('No fallback needed, suggestions are valid', {
      operation,
      category,
      suggestionCount: suggestions.length,
    });
    
    return false;
  }

  /**
   * Get fallback suggestions for a category
   * Provides category-appropriate fallback suggestions when primary suggestions fail
   * @param highlightedText - Original text
   * @param category - Category to get fallbacks for
   * @returns Fallback suggestions
   */
  getCategoryFallbacks(highlightedText: string, category?: string): Suggestion[] {
    const operation = 'getCategoryFallbacks';
    
    this.log.debug('Getting category fallbacks', {
      operation,
      category: category || null,
    });

    if (!category) {
      this.log.debug('No category specified, using generic fallbacks', { operation });
      return this._getGenericFallbacks();
    }

    const subcategory = detectSubcategory(highlightedText, category);

    // Get specific fallbacks for technical subcategories
    if (category === 'technical' && subcategory && CATEGORY_CONSTRAINTS.technical) {
      const constraint = CATEGORY_CONSTRAINTS.technical[subcategory as keyof typeof CATEGORY_CONSTRAINTS.technical];
      if (constraint && 'fallbacks' in constraint && Array.isArray(constraint.fallbacks)) {
        const fallbacks = constraint.fallbacks as Suggestion[];
        this.log.debug('Using technical subcategory fallbacks', {
          operation,
          subcategory,
          fallbackCount: fallbacks.length,
        });
        return fallbacks;
      }
    }

    // Get fallbacks for other categories
    const categoryConstraints = CATEGORY_CONSTRAINTS[category as keyof typeof CATEGORY_CONSTRAINTS];
    if (categoryConstraints && 'fallbacks' in categoryConstraints) {
      const fallbacks = (categoryConstraints as { fallbacks: Suggestion[] }).fallbacks;
      this.log.debug('Using category-specific fallbacks', {
        operation,
        category,
        fallbackCount: fallbacks.length,
      });
      return fallbacks;
    }

    // Generic fallbacks as last resort
    this.log.debug('Using generic fallbacks as last resort', { operation, category });
    return this._getGenericFallbacks(category);
  }

  /**
   * Get generic fallback suggestions
   * @private
   */
  private _getGenericFallbacks(category?: string): Suggestion[] {
    return [
      { text: "alternative option 1", category: category || 'general', explanation: "Alternative suggestion" },
      { text: "alternative option 2", category: category || 'general', explanation: "Different approach" },
      { text: "alternative option 3", category: category || 'general', explanation: "Creative variation" }
    ];
  }
}

