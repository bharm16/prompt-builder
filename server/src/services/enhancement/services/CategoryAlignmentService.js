import { logger } from '@infrastructure/Logger.ts';
import { CATEGORY_CONSTRAINTS, detectSubcategory } from '../config/CategoryConstraints.js';

/**
 * CategoryAlignmentService
 *
 * Responsible for enforcing category alignment and providing fallback suggestions.
 * Ensures suggestions match the expected category and provides alternatives when needed.
 *
 * Single Responsibility: Category validation and fallback management
 */
export class CategoryAlignmentService {
  constructor(validationService) {
    this.validationService = validationService;
  }

  /**
   * Enforce category alignment for suggestions
   * Validates suggestions match the category or provides fallbacks
   * @param {Array} suggestions - Array of suggestions to validate
   * @param {Object} params - Validation parameters
   * @returns {Object} Result with suggestions and metadata
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
    const validSuggestions = this.validationService.validateSuggestions(
      suggestions,
      highlightedText,
      highlightedCategory
    );

    return {
      suggestions: validSuggestions,
      fallbackApplied: false,
      context: { baseCategory: highlightedCategory }
    };
  }

  /**
   * Determine if fallback suggestions should be used
   * Checks for category mismatches and quality issues
   * @param {Array} suggestions - Suggestions to validate
   * @param {string} highlightedText - Original text
   * @param {string} category - Expected category
   * @returns {boolean} True if fallbacks should be used
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
   * Provides category-appropriate fallback suggestions when primary suggestions fail
   * @param {string} highlightedText - Original text
   * @param {string} category - Category to get fallbacks for
   * @returns {Array} Fallback suggestions
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
}
