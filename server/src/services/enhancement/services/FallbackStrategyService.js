import nlp from 'compromise';
import { logger } from '../../../infrastructure/Logger.js';
import { GRAMMATICAL_CONFIG } from '../config/grammaticalAnalysis.js';

/**
 * FallbackStrategyService
 * 
 * Provides safe algorithmic transformations when LLM generation fails.
 * Uses compromise NLP to apply proven linguistic transformations without
 * hardcoded word lists or risky modifications.
 * 
 * Single Responsibility: Algorithmic text enhancement fallback
 */
export class FallbackStrategyService {
  constructor(config = GRAMMATICAL_CONFIG) {
    this.config = config.fallback;
  }

  /**
   * Generate fallback enhancement using safe algorithmic transformations
   * @param {string} originalText - Original text to enhance
   * @param {Object} analysis - Grammatical analysis of the original text
   * @returns {string} Enhanced text using algorithmic transformations
   */
  generateFallback(originalText, analysis) {
    if (!originalText || typeof originalText !== 'string') {
      logger.warn('Invalid input to fallback strategy');
      return originalText;
    }

    logger.info('Applying algorithmic fallback transformations', {
      originalText,
      structure: analysis.structure,
      complexity: analysis.complexity.toFixed(3),
    });

    const doc = nlp(originalText);
    let transformationCount = 0;

    // Apply safe transformations based on configuration
    if (this.config.enableVerbIntensification && transformationCount < this.config.maxTransformations) {
      const verbTransformed = this._intensifyVerbs(doc);
      if (verbTransformed) {
        transformationCount++;
        logger.debug('Applied verb intensification', { transformationCount });
      }
    }

    if (this.config.enableAdjectiveExpansion && transformationCount < this.config.maxTransformations) {
      const adjectiveTransformed = this._expandAdjectives(doc);
      if (adjectiveTransformed) {
        transformationCount++;
        logger.debug('Applied adjective expansion', { transformationCount });
      }
    }

    const result = doc.text();

    logger.info('Fallback transformations complete', {
      transformationsApplied: transformationCount,
      originalLength: originalText.length,
      resultLength: result.length,
    });

    return result;
  }

  /**
   * Intensify verbs by converting to continuous aspect
   * Converts simple present/past to continuous form for more immediacy
   * Example: "He runs" -> "He is running"
   * @param {Object} doc - Compromise document (mutates in place)
   * @returns {boolean} True if transformation was applied
   * @private
   */
  _intensifyVerbs(doc) {
    const verbs = doc.verbs();

    if (!verbs.found) {
      return false;
    }

    // Only transform if not already in continuous form and no auxiliary
    // This prevents "is running" -> "is is running"
    if (verbs.has('#Gerund') || verbs.has('#Auxiliary')) {
      return false;
    }

    try {
      // Convert to continuous/progressive aspect
      // compromise handles this transformation safely
      verbs.toContinuous();
      return true;
    } catch (error) {
      logger.debug('Verb intensification failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Expand adjectives by applying comparative form or adding intensifiers
   * Only modifies "naked" adjectives (no existing adverb modifiers)
   * Example: "dark sky" -> "darker sky"
   * @param {Object} doc - Compromise document (mutates in place)
   * @returns {boolean} True if transformation was applied
   * @private
   */
  _expandAdjectives(doc) {
    const adjectives = doc.adjectives();

    if (!adjectives.found) {
      return false;
    }

    // Find adjectives without existing adverb modifiers
    // We check if there's an adverb immediately before the adjective
    const nakedAdjectives = [];
    
    adjectives.forEach((adj) => {
      const before = adj.lookBehind(1);
      // Only include if previous term is not an adverb
      if (!before.has('#Adverb')) {
        nakedAdjectives.push(adj);
      }
    });

    if (nakedAdjectives.length === 0) {
      return false;
    }

    try {
      // Apply comparative form to first naked adjective
      // This is safer than inserting adverbs which might clash
      // Example: "dark" -> "darker", "beautiful" -> "more beautiful"
      const firstAdjective = nakedAdjectives[0];
      firstAdjective.toComparative();
      return true;
    } catch (error) {
      logger.debug('Adjective expansion failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Apply a safe adverbial intensifier to adjectives
   * Alternative to comparative form (currently not used by default)
   * @param {Object} doc - Compromise document
   * @returns {boolean} True if transformation was applied
   * @private
   */
  _addIntensifier(doc) {
    const adjectives = doc.adjectives();

    if (!adjectives.found) {
      return false;
    }

    try {
      // Add "very" or "quite" before first adjective
      // This is more conservative than superlative forms
      const firstAdj = adjectives.first();
      const before = firstAdj.lookBehind(1);
      
      // Only add if no existing adverb
      if (!before.has('#Adverb')) {
        // Note: compromise doesn't have a built-in method to insert text
        // This is a placeholder for future enhancement
        // For now, we skip this transformation
        return false;
      }
    } catch (error) {
      logger.debug('Intensifier addition failed', {
        error: error.message,
      });
      return false;
    }

    return false;
  }
}

export default FallbackStrategyService;

