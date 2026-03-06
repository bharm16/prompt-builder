import { logger } from '@infrastructure/Logger';
import { CONSTRAINT_THRESHOLDS } from '@services/video-prompt-analysis/config/constraintModes';
import { getParentCategory } from '@shared/taxonomy';
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
 * Responsible for enforcing category alignment of AI-generated suggestions.
 * When suggestions are insufficient or mismatched, returns empty so the
 * downstream FallbackRegenerationService can handle the gap with LLM calls.
 *
 * Single Responsibility: Category validation and alignment gating
 */
export class CategoryAlignmentService {
  private readonly log = logger.child({ service: 'CategoryAlignmentService' });
  private readonly legacyCategoryToParent: Record<string, string> = {
    descriptive: 'style',
    framing: 'shot',
    cameramove: 'camera',
  };

  constructor(private readonly validationService: ValidationService) {}

  /**
   * Enforce category alignment for suggestions
   * Validates suggestions match the category or returns empty for LLM fallback
   * @param suggestions - Array of suggestions to validate
   * @param params - Validation parameters
   * @returns Result with suggestions and metadata
   */
  enforceCategoryAlignment(suggestions: Suggestion[], params: ValidationParams): CategoryAlignmentResult {
    const operation = 'enforceCategoryAlignment';
    const { highlightedText, highlightedCategory, highlightedCategoryConfidence } = params;
    const confidenceIsLow =
      typeof highlightedCategoryConfidence === 'number' &&
      highlightedCategoryConfidence < CONSTRAINT_THRESHOLDS.MIN_CATEGORY_CONFIDENCE;

    this.log.debug('Enforcing category alignment', {
      operation,
      suggestionCount: suggestions.length,
      category: highlightedCategory || null,
    });

    // Check if we need fallbacks
    const needsFallback = this.shouldUseFallback(
      suggestions,
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence ?? null
    );

    if (needsFallback) {
      this.log.warn('Returning empty for LLM-based fallback regeneration', {
        operation,
        originalSuggestionCount: suggestions.length,
        category: highlightedCategory || null,
      });

      return {
        suggestions: [],
        fallbackApplied: true,
        context: {
          ...(highlightedCategory ? { baseCategory: highlightedCategory } : {}),
          originalSuggestionsRejected: suggestions.length,
          reason: 'Category mismatch or low confidence',
        },
      };
    }

    if (confidenceIsLow) {
      this.log.info('Skipping category validation due to low confidence', {
        operation,
        category: highlightedCategory || null,
        confidence: highlightedCategoryConfidence,
      });
      return {
        suggestions,
        fallbackApplied: false,
        context: {
          ...(highlightedCategory ? { baseCategory: highlightedCategory } : {}),
          reason: 'Low category confidence',
        },
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

    const context = highlightedCategory ? { baseCategory: highlightedCategory } : {};

    return {
      suggestions: validSuggestions,
      fallbackApplied: false,
      context,
    };
  }

  /**
   * Determine if fallback suggestions should be used
   * Uses count-based heuristics only — no regex-based category detection.
   * Cross-category contamination is handled downstream by _failsSlotFitGuard
   * in SuggestionValidationService.sanitizeSuggestions().
   * @param suggestions - Suggestions to validate
   * @param _highlightedText - Original text (unused after regex removal)
   * @param _category - Expected category (unused after regex removal)
   * @param confidence - Category confidence score
   * @returns True if fallbacks should be used
   */
  shouldUseFallback(
    suggestions: Suggestion[],
    _highlightedText: string,
    _category?: string,
    confidence?: number | null
  ): boolean {
    const operation = 'shouldUseFallback';
    const confidenceIsLow =
      typeof confidence === 'number' &&
      confidence < CONSTRAINT_THRESHOLDS.MIN_CATEGORY_CONFIDENCE;

    // Use fallback if no suggestions
    if (!suggestions || suggestions.length === 0) {
      this.log.debug('Fallback needed: no suggestions', {
        operation,
        suggestionCount: suggestions?.length || 0,
      });
      return true;
    }

    // Don't trigger fallback on low-confidence spans — let them pass through
    if (confidenceIsLow) {
      this.log.debug('Category confidence low, skipping fallback checks', {
        operation,
        confidence,
      });
      return false;
    }

    // Use fallback if fewer than 2 suggestions survived
    if (suggestions.length < 2) {
      this.log.debug('Fallback needed: insufficient suggestions', {
        operation,
        suggestionCount: suggestions.length,
      });
      return true;
    }

    return false;
  }

  /**
   * Resolve parent category from a full taxonomy ID or legacy category name
   * @private
   */
  private _resolveParentCategory(category: string): string | null {
    const explicitParent = getParentCategory(category);
    if (explicitParent) {
      return explicitParent;
    }
    return this.legacyCategoryToParent[category.toLowerCase()] || null;
  }
}
