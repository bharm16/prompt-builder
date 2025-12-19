import { logger } from '@infrastructure/Logger';
import {
  PRIMARY_INTENT_PATTERNS,
  NARRATIVE_DIRECTION_PATTERNS,
  EMOTIONAL_TONE_PATTERNS,
  CONFLICT_PATTERNS,
} from '../config/intentPatterns.js';
import type { CreativeIntent, StyleConflict } from '../../types.js';

/**
 * Creative Intent Analyzer
 *
 * Analyzes brainstorm elements to infer creative intent and detect style conflicts.
 * Single Responsibility: Pattern matching and semantic analysis of creative direction.
 */
export class CreativeIntentAnalyzer {
  private readonly log = logger.child({ service: 'CreativeIntentAnalyzer' });

  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Infer creative intent from element combinations
   * Analyzes how elements work together to understand the narrative intent
   *
   * @param elements - Brainstorm elements
   * @returns Creative intent analysis or null if no intent detected
   */
  inferCreativeIntent(
    elements: Record<string, string> | null | undefined
  ): CreativeIntent | null {
    const operation = 'inferCreativeIntent';
    
    if (!elements || typeof elements !== 'object') {
      this.log.debug('No elements provided for intent inference', {
        operation,
      });
      return null;
    }
    
    this.log.debug('Inferring creative intent', {
      operation,
      elementCount: Object.keys(elements).length,
    });

    const analysis: CreativeIntent = {
      primaryIntent: null,
      supportingThemes: [],
      narrativeDirection: null,
      emotionalTone: null,
    };

    // Combine all element values into searchable text
    const elementText = Object.values(elements)
      .filter((v) => typeof v === 'string')
      .join(' ')
      .toLowerCase();

    // Detect primary intent using configuration patterns
    for (const { pattern, intent, theme } of PRIMARY_INTENT_PATTERNS) {
      if (elementText.match(pattern)) {
        analysis.primaryIntent = intent;
        analysis.supportingThemes.push(theme);
        break; // First match wins
      }
    }

    // Detect narrative direction using configuration patterns
    for (const { pattern, direction } of NARRATIVE_DIRECTION_PATTERNS) {
      if (elementText.match(pattern)) {
        analysis.narrativeDirection = direction;
        break; // First match wins
      }
    }

    // Detect emotional tone using configuration patterns
    for (const { pattern, tone } of EMOTIONAL_TONE_PATTERNS) {
      if (elementText.match(pattern)) {
        analysis.emotionalTone = tone;
        break; // First match wins
      }
    }

    // Return null if no intent was detected
    const result = analysis.primaryIntent ? analysis : null;
    
    if (result) {
      this.log.debug('Creative intent inferred', {
        operation,
        primaryIntent: result.primaryIntent,
        narrativeDirection: result.narrativeDirection,
        emotionalTone: result.emotionalTone,
        supportingThemesCount: result.supportingThemes.length,
      });
    } else {
      this.log.debug('No creative intent detected', {
        operation,
      });
    }
    
    return result;
  }

  /**
   * Detect style conflicts in element combinations
   * Identifies clashing or contradictory elements
   *
   * @param elements - Brainstorm elements
   * @returns Array of detected conflicts
   */
  detectStyleConflicts(
    elements: Record<string, string> | null | undefined
  ): StyleConflict[] {
    const operation = 'detectStyleConflicts';
    
    if (!elements || typeof elements !== 'object') {
      this.log.debug('No elements provided for conflict detection', {
        operation,
      });
      return [];
    }
    
    this.log.debug('Detecting style conflicts', {
      operation,
      elementCount: Object.keys(elements).length,
    });

    const conflicts: StyleConflict[] = [];

    // Combine all element values into searchable text
    const elementText = Object.values(elements)
      .filter((v) => typeof v === 'string')
      .join(' ')
      .toLowerCase();

    // Check for conflicts using configuration patterns
    for (const {
      firstPattern,
      secondPattern,
      type,
      description,
      suggestion,
    } of CONFLICT_PATTERNS) {
      if (
        elementText.match(firstPattern) &&
        elementText.match(secondPattern)
      ) {
        conflicts.push({
          type,
          description,
          suggestion,
        });
      }
    }

    this.log.debug('Style conflict detection complete', {
      operation,
      conflictCount: conflicts.length,
    });

    return conflicts;
  }
}
