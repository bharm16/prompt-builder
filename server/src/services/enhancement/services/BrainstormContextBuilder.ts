import { logger } from '@infrastructure/Logger';
import { CreativeIntentAnalyzer } from './brainstorm-context/services/CreativeIntentAnalyzer.js';
import { ElementSuggester } from './brainstorm-context/services/ElementSuggester.js';
import { BrainstormFormatter } from './brainstorm-context/services/BrainstormFormatter.js';
import type {
  BrainstormContext,
  BrainstormSignature,
  CreativeIntent,
  StyleConflict,
  ComplementaryElement,
  MissingElement,
} from './types.js';

/**
 * BrainstormContextBuilder
 *
 * Orchestrates brainstorm context management by delegating to specialized services:
 * - CreativeIntentAnalyzer: Intent inference and conflict detection
 * - ElementSuggester: Missing elements and complementary suggestions
 * - BrainstormFormatter: Formatting and presentation
 *
 * Single Responsibility: Orchestrate brainstorm context workflow and build output
 */
export class BrainstormContextBuilder {
  private intentAnalyzer: CreativeIntentAnalyzer;
  private elementSuggester: ElementSuggester;
  private formatter: BrainstormFormatter;
  private readonly log = logger.child({ service: 'BrainstormContextBuilder' });

  constructor() {
    // Instantiate specialized services
    this.intentAnalyzer = new CreativeIntentAnalyzer();
    this.elementSuggester = new ElementSuggester();
    this.formatter = new BrainstormFormatter();
  }

  /**
   * Build a compact signature of brainstorm context for caching
   * @param brainstormContext - Brainstorm context object
   * @returns Normalized signature or null
   */
  buildBrainstormSignature(
    brainstormContext: BrainstormContext | null | undefined
  ): BrainstormSignature | null {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return null;
    }

    const { elements = {}, metadata = {} } = brainstormContext;

    const normalizedElements = Object.entries(elements).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) {
            acc[key] = trimmed;
          }
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const normalizedMetadata: BrainstormSignature['metadata'] = {};
    if (metadata && typeof metadata === 'object') {
      if (typeof metadata.format === 'string' && metadata.format.trim()) {
        normalizedMetadata.format = metadata.format.trim();
      }

      if (
        metadata.technicalParams &&
        typeof metadata.technicalParams === 'object'
      ) {
        const technicalEntries = Object.entries(
          metadata.technicalParams
        ).reduce((acc, [key, value]) => {
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
        }, {} as Record<string, unknown>);

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

    const signature: BrainstormSignature = {};
    if (Object.keys(normalizedElements).length) {
      signature.elements = normalizedElements;
    }
    if (Object.keys(normalizedMetadata).length) {
      signature.metadata = normalizedMetadata;
    }

    return Object.keys(signature).length ? signature : null;
  }

  /**
   * Infer creative intent from element combinations
   * Delegates to CreativeIntentAnalyzer
   *
   * @param elements - Brainstorm elements
   * @returns Creative intent analysis
   */
  inferCreativeIntent(
    elements: Record<string, string> | null | undefined
  ): CreativeIntent | null {
    return this.intentAnalyzer.inferCreativeIntent(elements);
  }

  /**
   * Suggest missing elements based on creative intent
   * Delegates to ElementSuggester
   *
   * @param intent - Creative intent from inferCreativeIntent
   * @param elements - Existing elements
   * @returns Suggested missing elements
   */
  suggestMissingElements(
    intent: CreativeIntent | null,
    elements: Record<string, string> | null | undefined
  ): MissingElement[] {
    return this.elementSuggester.suggestMissingElements(intent, elements);
  }

  /**
   * Detect style conflicts in element combinations
   * Delegates to CreativeIntentAnalyzer
   *
   * @param elements - Brainstorm elements
   * @returns Detected conflicts
   */
  detectStyleConflicts(
    elements: Record<string, string> | null | undefined
  ): StyleConflict[] {
    return this.intentAnalyzer.detectStyleConflicts(elements);
  }

  /**
   * Get complementary elements for a given element
   * Delegates to ElementSuggester
   *
   * @param element - Element to find complements for
   * @param intent - Creative intent
   * @returns Complementary elements
   */
  getComplementaryElements(
    element: string,
    intent: CreativeIntent | null
  ): ComplementaryElement[] {
    return this.elementSuggester.getComplementaryElements(element, intent);
  }

  /**
   * Build brainstorm context section for prompt inclusion
   * ENHANCED: Includes creative intent analysis, missing elements, and relationships
   *
   * Orchestrates:
   * 1. Intent analysis (via CreativeIntentAnalyzer)
   * 2. Conflict detection (via CreativeIntentAnalyzer)
   * 3. Missing element suggestions (via ElementSuggester)
   * 4. Complementary element lookup (via ElementSuggester)
   * 5. Formatting (via BrainstormFormatter)
   *
   * @param brainstormContext - Brainstorm context object
   * @param options - Options for context building
   * @returns Formatted context section
   */
  buildBrainstormContextSection(
    brainstormContext: BrainstormContext | null | undefined,
    options: { includeCategoryGuidance?: boolean; isVideoPrompt?: boolean } = {}
  ): string {
    const startTime = performance.now();
    const operation = 'buildBrainstormContextSection';
    
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      this.log.debug('Empty brainstorm context, returning empty string', {
        operation,
      });
      return '';
    }

    const { includeCategoryGuidance = false, isVideoPrompt = false } = options;
    
    this.log.debug('Building brainstorm context section', {
      operation,
      includeCategoryGuidance,
      isVideoPrompt,
      hasElements: !!(brainstormContext.elements && Object.keys(brainstormContext.elements).length > 0),
    });
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

    if (
      !definedElements.length &&
      !technicalParams.length &&
      !formatPreference &&
      validationScore === null
    ) {
      return '';
    }

    // Delegate analysis to specialized services
    const intent = this.inferCreativeIntent(elements);
    const conflicts = this.detectStyleConflicts(elements);
    const missingElements = intent
      ? this.suggestMissingElements(intent, elements)
      : [];

    // Build output section
    let section = '**Creative Brainstorm Structured Context:**\n';
    section +=
      'These are user-confirmed anchors that suggestions must respect.\n';

    if (definedElements.length) {
      definedElements.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${value.trim()}\n`;
      });
    }

    // Include creative intent analysis
    if (intent && intent.primaryIntent) {
      section += '\n**Creative Intent Analysis:**\n';
      section += `The elements suggest a "${intent.primaryIntent}" direction`;

      if (intent.narrativeDirection) {
        section += ` with a "${intent.narrativeDirection}" narrative arc`;
      }

      if (intent.emotionalTone) {
        section += `, conveying a ${intent.emotionalTone} emotional tone`;
      }

      section += '.\n';

      if (intent.supportingThemes.length > 0) {
        section += `Supporting themes: ${intent.supportingThemes.join(', ')}.\n`;
      }

      // Show element relationships as narrative
      section += '\n**Element Relationships:**\n';
      definedElements.forEach(([key, value]) => {
        const complements = this.getComplementaryElements(value, intent);
        if (complements.length > 0) {
          section += `- "${value}" naturally pairs with:\n`;
          complements.slice(0, 2).forEach((c) => {
            section += `  • ${c.element} (${c.reason})\n`;
          });
        }
      });
    }

    // Highlight gaps and opportunities
    if (missingElements.length > 0) {
      section += '\n**Opportunities to Strengthen:**\n';
      missingElements.forEach(({ category, reason }) => {
        section += `- Consider adding ${category}: ${reason}\n`;
      });
    }

    // Warn about conflicts
    if (conflicts.length > 0) {
      section += '\n**⚠️  Style Considerations:**\n';
      conflicts.forEach((c) => {
        section += `- ${c.description}\n`;
        section += `  Suggestion: ${c.suggestion}\n`;
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
      section +=
        "\nUse these anchors to inspire category labels and keep suggestions aligned with the user's core concept.\n";
    } else {
      section +=
        '\nEnsure every rewrite strengthens these anchors and creative intent rather than contradicting them.\n';
    }

    if (isVideoPrompt) {
      section +=
        'Translate these anchors into cinematic details that serve the narrative direction.\n';
    }

    const duration = Math.round(performance.now() - startTime);
    
    this.log.info('Brainstorm context section built', {
      operation,
      duration,
      sectionLength: section.length,
      hasIntent: !!intent,
      conflictCount: conflicts.length,
      missingElementCount: missingElements.length,
    });

    return section;
  }

  /**
   * Format brainstorm keys into human-readable labels
   * Delegates to BrainstormFormatter
   *
   * @param key - Key to format
   * @returns Formatted key
   */
  formatBrainstormKey(key: string): string {
    return this.formatter.formatBrainstormKey(key);
  }

  /**
   * Normalize brainstorm metadata values for prompt inclusion
   * Delegates to BrainstormFormatter
   *
   * @param value - Value to format
   * @returns Formatted value
   */
  formatBrainstormValue(value: unknown): string {
    return this.formatter.formatBrainstormValue(value);
  }
}
