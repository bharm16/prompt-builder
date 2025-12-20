import { logger } from '@infrastructure/Logger';
import {
  MISSING_ELEMENT_RULES,
  NARRATIVE_MISSING_ELEMENT_RULES,
  COMPLEMENTARY_RULES,
} from '../config/intentPatterns.js';
import type {
  CreativeIntent,
  MissingElement,
  ComplementaryElement,
} from '@services/enhancement/services/types';

/**
 * Element Suggester
 *
 * Suggests missing elements based on creative intent and finds complementary
 * elements that naturally pair with existing ones.
 * Single Responsibility: Gap analysis and relationship mapping.
 */
export class ElementSuggester {
  private readonly log = logger.child({ service: 'ElementSuggester' });

  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Suggest missing elements based on creative intent
   * Identifies gaps in the creative direction using taxonomy-based mappings
   *
   * @param intent - Creative intent from inferCreativeIntent
   * @param elements - Existing elements
   * @returns Suggested missing elements
   */
  suggestMissingElements(
    intent: CreativeIntent | null,
    elements: Record<string, string> | null | undefined
  ): MissingElement[] {
    const operation = 'suggestMissingElements';
    
    if (!intent || !intent.primaryIntent) {
      this.log.debug('No intent provided for missing element suggestions', {
        operation,
      });
      return [];
    }
    
    this.log.debug('Suggesting missing elements', {
      operation,
      primaryIntent: intent.primaryIntent,
      elementCount: elements ? Object.keys(elements).length : 0,
    });

    const suggestions: MissingElement[] = [];

    // Helper to check if elements contain any of the keywords
    const hasElement = (keywords: string[]): boolean => {
      const elementText = Object.values(elements || {})
        .join(' ')
        .toLowerCase();
      return keywords.some((k) => elementText.includes(k));
    };

    // Check intent-specific missing elements
    const intentRule = MISSING_ELEMENT_RULES.find(
      (rule) => rule.intent === intent.primaryIntent
    );

    if (intentRule) {
      for (const check of intentRule.checks) {
        if (!hasElement(check.keywords)) {
          suggestions.push({
            category: check.suggestion.category,
            displayLabel: check.suggestion.displayLabel,
            reason: check.suggestion.reason,
          });
        }
      }
    }

    // Check narrative-specific missing elements
    if (intent.narrativeDirection) {
      const narrativeRule = NARRATIVE_MISSING_ELEMENT_RULES.find(
        (rule) => rule.narrativeDirection === intent.narrativeDirection
      );

      if (narrativeRule) {
        for (const check of narrativeRule.checks) {
          if (!hasElement(check.keywords)) {
            suggestions.push({
              category: check.suggestion.category,
              displayLabel: check.suggestion.displayLabel,
              reason: check.suggestion.reason,
            });
          }
        }
      }
    }

    this.log.debug('Missing element suggestions complete', {
      operation,
      suggestionCount: suggestions.length,
    });

    return suggestions;
  }

  /**
   * Get complementary elements for a given element
   * Suggests what naturally pairs with an element given the creative intent
   *
   * @param element - Element to find complements for
   * @param intent - Creative intent
   * @returns Complementary elements
   */
  getComplementaryElements(
    element: string,
    intent: CreativeIntent | null
  ): ComplementaryElement[] {
    const operation = 'getComplementaryElements';
    
    if (!element || typeof element !== 'string') {
      this.log.debug('Invalid element provided for complementary lookup', {
        operation,
      });
      return [];
    }
    
    this.log.debug('Finding complementary elements', {
      operation,
      element,
      hasIntent: !!intent,
      primaryIntent: intent?.primaryIntent || null,
    });

    const elementLower = element.toLowerCase();
    const complements: ComplementaryElement[] = [];

    // Check each complementary rule
    for (const rule of COMPLEMENTARY_RULES) {
      if (elementLower.match(rule.pattern)) {
        // Add base complements
        complements.push(...rule.complements);

        // Add intent-specific complements if applicable
        if (rule.intentSpecific && intent && intent.primaryIntent) {
          const intentSpecificComplements =
            rule.intentSpecific[intent.primaryIntent];
          if (intentSpecificComplements) {
            complements.push(...intentSpecificComplements);
          }
        }
      }
    }

    this.log.debug('Complementary elements found', {
      operation,
      complementCount: complements.length,
    });

    return complements;
  }
}
