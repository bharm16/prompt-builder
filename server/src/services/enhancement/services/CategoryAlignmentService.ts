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
  constructor(private readonly validationService: ValidationService) {}

  /**
   * Enforce category alignment for suggestions
   * Validates suggestions match the category or provides fallbacks
   * @param suggestions - Array of suggestions to validate
   * @param params - Validation parameters
   * @returns Result with suggestions and metadata
   */
  enforceCategoryAlignment(suggestions: Suggestion[], params: ValidationParams): CategoryAlignmentResult {
    const { highlightedText, highlightedCategory } = params;

    // Check if we need fallbacks
    const needsFallback = this.shouldUseFallback(suggestions, highlightedText, highlightedCategory);

    if (needsFallback) {
      const fallbacks = this.getCategoryFallbacks(highlightedText, highlightedCategory);
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
    // Use fallback if no suggestions or very low count
    if (!suggestions || suggestions.length < 2) return true;

    if (!category) return false;

    // Check for category mismatches
    if (category === 'technical' && CATEGORY_CONSTRAINTS.technical) {
      const subcategory = detectSubcategory(highlightedText, category);
      if (subcategory) {
        const constraint = CATEGORY_CONSTRAINTS.technical[subcategory as keyof typeof CATEGORY_CONSTRAINTS.technical];
        if (constraint && 'pattern' in constraint && constraint.pattern instanceof RegExp) {
          const validCount = suggestions.filter(s =>
            constraint.pattern.test(s.text)
          ).length;
          return validCount < suggestions.length * 0.5;
        }
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
   * Provides category-appropriate fallback suggestions when primary suggestions fail
   * @param highlightedText - Original text
   * @param category - Category to get fallbacks for
   * @returns Fallback suggestions
   */
  getCategoryFallbacks(highlightedText: string, category?: string): Suggestion[] {
    if (!category) {
      return this._getGenericFallbacks();
    }

    const subcategory = detectSubcategory(highlightedText, category);

    // Get specific fallbacks for technical subcategories
    if (category === 'technical' && subcategory && CATEGORY_CONSTRAINTS.technical) {
      const constraint = CATEGORY_CONSTRAINTS.technical[subcategory as keyof typeof CATEGORY_CONSTRAINTS.technical];
      if (constraint && 'fallbacks' in constraint && Array.isArray(constraint.fallbacks)) {
        return constraint.fallbacks as Suggestion[];
      }
    }

    // Get fallbacks for other categories
    const categoryConstraints = CATEGORY_CONSTRAINTS[category as keyof typeof CATEGORY_CONSTRAINTS];
    if (categoryConstraints && 'fallbacks' in categoryConstraints) {
      return (categoryConstraints as { fallbacks: Suggestion[] }).fallbacks;
    }

    // Generic fallbacks as last resort
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

