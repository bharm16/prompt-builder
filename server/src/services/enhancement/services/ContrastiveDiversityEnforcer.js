import { logger } from '../../infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '../../../utils/StructuredOutputEnforcer.js';

/**
 * ContrastiveDiversityEnforcer
 * 
 * Implements PDF Section 6.3: Diversity Sampling with Contrastive Penalty
 * 
 * Prevents "visual collapse" by generating suggestions in batches with:
 * - Increasing temperature (0.7 → 0.9 → 1.0)
 * - Negative constraints listing previous batches
 * - Forced exploration of orthogonal semantic spaces
 * 
 * This addresses the failure mode where standard temperature sampling
 * clusters around the most probable synonyms instead of truly diverse options.
 * 
 * Reference: "Prompt Engineering for Video Prompts" PDF, Section 6.3
 * "Standard temperature sampling is often insufficient for generating 12 truly
 * distinct ideas; models tend to cluster around the most probable synonyms."
 */
export class ContrastiveDiversityEnforcer {
  constructor(aiService) {
    this.ai = aiService;
    
    // Configuration from PDF recommendations
    this.config = {
      batchSizes: [4, 4, 4], // Total: 12 suggestions
      temperatures: [0.7, 0.9, 1.0], // Increasing creativity
      enabled: true,
    };
  }

  /**
   * Generate diverse suggestions using contrastive decoding approach
   * 
   * @param {Object} context - Generation context
   * @param {string} context.systemPrompt - Base system prompt
   * @param {Object} context.schema - JSON schema for output
   * @param {boolean} context.isVideoPrompt - Whether this is for video prompts
   * @param {boolean} context.isPlaceholder - Whether this is placeholder generation
   * @param {string} context.highlightedText - The text being enhanced
   * @returns {Promise<Array>} Array of diverse suggestions
   */
  async generateWithContrastiveDecoding(context) {
    const startTime = Date.now();
    
    if (!this.shouldUseContrastiveDecoding(context)) {
      logger.debug('Contrastive decoding not needed for this context');
      return null; // Signal to use standard generation
    }

    logger.info('Using contrastive decoding for enhanced diversity', {
      isVideoPrompt: context.isVideoPrompt,
      highlightedText: context.highlightedText?.substring(0, 50),
    });

    try {
      const allSuggestions = [];
      
      // Batch 1: Standard temperature, no constraints
      const batch1 = await this._generateBatch({
        ...context,
        temperature: this.config.temperatures[0],
        count: this.config.batchSizes[0],
        negativeConstraint: null,
        batchNumber: 1,
      });
      allSuggestions.push(...batch1);
      
      // Batch 2: Higher temperature, constrain against Batch 1
      const batch2 = await this._generateBatch({
        ...context,
        temperature: this.config.temperatures[1],
        count: this.config.batchSizes[1],
        negativeConstraint: this._buildNegativeConstraint(batch1),
        batchNumber: 2,
      });
      allSuggestions.push(...batch2);
      
      // Batch 3: Highest temperature, constrain against Batches 1+2
      const batch3 = await this._generateBatch({
        ...context,
        temperature: this.config.temperatures[2],
        count: this.config.batchSizes[2],
        negativeConstraint: this._buildNegativeConstraint([...batch1, ...batch2]),
        batchNumber: 3,
      });
      allSuggestions.push(...batch3);

      const totalTime = Date.now() - startTime;
      
      logger.info('Contrastive decoding completed', {
        totalSuggestions: allSuggestions.length,
        batch1Count: batch1.length,
        batch2Count: batch2.length,
        batch3Count: batch3.length,
        totalTime,
      });

      return allSuggestions;
    } catch (error) {
      logger.error('Contrastive decoding failed, will fallback to standard generation', { error });
      return null; // Signal to use standard generation
    }
  }

  /**
   * Determine if contrastive decoding should be used
   * 
   * Criteria from PDF:
   * - Video prompts (high need for visual diversity)
   * - Placeholder generation (need varied creative directions)
   * - NOT for simple text replacements (overhead not justified)
   * 
   * @param {Object} context - Generation context
   * @returns {boolean} True if contrastive decoding should be used
   */
  shouldUseContrastiveDecoding(context) {
    if (!this.config.enabled) {
      return false;
    }

    // Video prompts benefit most from visual diversity
    if (context.isVideoPrompt) {
      return true;
    }

    // Placeholder generation needs diverse creative directions
    if (context.isPlaceholder) {
      return true;
    }

    // For short text replacements, standard generation is sufficient
    const textLength = context.highlightedText?.length || 0;
    if (textLength < 20) {
      return false;
    }

    return false;
  }

  /**
   * Generate a single batch of suggestions
   * 
   * @param {Object} params - Batch generation parameters
   * @returns {Promise<Array>} Batch of suggestions
   * @private
   */
  async _generateBatch(params) {
    const {
      systemPrompt,
      schema,
      temperature,
      count,
      negativeConstraint,
      batchNumber,
    } = params;

    // Build augmented prompt with negative constraint
    const augmentedPrompt = negativeConstraint
      ? this._augmentPromptWithConstraint(systemPrompt, negativeConstraint)
      : systemPrompt;

    logger.debug(`Generating batch ${batchNumber}`, {
      temperature,
      count,
      hasConstraint: !!negativeConstraint,
    });

    try {
      const suggestions = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        augmentedPrompt,
        {
          schema,
          isArray: true,
          maxTokens: 2048,
          maxRetries: 2,
          temperature,
          operation: 'enhance_suggestions',
        }
      );

      // Validate we got the right count
      if (!Array.isArray(suggestions)) {
        throw new Error('Expected array of suggestions');
      }

      // Take only the requested count
      const batch = suggestions.slice(0, count);
      
      if (batch.length < count) {
        logger.warn(`Batch ${batchNumber} generated fewer suggestions than requested`, {
          requested: count,
          received: batch.length,
        });
      }

      return batch;
    } catch (error) {
      logger.error(`Failed to generate batch ${batchNumber}`, { error });
      throw error;
    }
  }

  /**
   * Build negative constraint text from previous suggestions
   * 
   * Per PDF Section 6.3:
   * "Generate the next 4 with a higher temperature and a Negative Constraint:
   * 'Do not use concepts related to [List of first 4 options].'"
   * 
   * @param {Array} previousSuggestions - Previous batch(es) of suggestions
   * @returns {string} Negative constraint text
   * @private
   */
  _buildNegativeConstraint(previousSuggestions) {
    if (!previousSuggestions || previousSuggestions.length === 0) {
      return null;
    }

    const previousTexts = previousSuggestions
      .map(s => s.text || s)
      .filter(Boolean)
      .map(text => `"${text}"`)
      .join(', ');

    return `Do not use concepts, phrases, or visual approaches similar to: ${previousTexts}`;
  }

  /**
   * Augment system prompt with negative constraint
   * 
   * Injects the constraint prominently so the model respects it
   * 
   * @param {string} basePrompt - Original system prompt
   * @param {string} constraint - Negative constraint to add
   * @returns {string} Augmented prompt
   * @private
   */
  _augmentPromptWithConstraint(basePrompt, constraint) {
    if (!constraint) {
      return basePrompt;
    }

    // Insert constraint prominently after the main instructions
    const constraintSection = `

**CRITICAL DIVERSITY CONSTRAINT:**
${constraint}

You MUST generate options that explore completely different semantic directions.
Think orthogonally - different visual angles, different narrative approaches, different stylistic choices.
Avoid synonyms or minor variations of the above concepts.

---

`;

    // Insert after first paragraph/section
    const firstBreakIndex = basePrompt.indexOf('\n\n');
    if (firstBreakIndex > 0) {
      return (
        basePrompt.substring(0, firstBreakIndex) +
        constraintSection +
        basePrompt.substring(firstBreakIndex)
      );
    }

    // Fallback: prepend to prompt
    return constraintSection + basePrompt;
  }

  /**
   * Calculate diversity metrics for evaluation
   * 
   * Measures how well contrastive decoding achieved diversity goals
   * Uses Jaccard similarity (same as existing SuggestionDeduplicator)
   * 
   * @param {Array} suggestions - All generated suggestions
   * @returns {Object} Diversity metrics
   */
  calculateDiversityMetrics(suggestions) {
    if (!suggestions || suggestions.length < 2) {
      return { avgSimilarity: 0, minSimilarity: 0, maxSimilarity: 0 };
    }

    const similarities = [];
    
    for (let i = 0; i < suggestions.length; i++) {
      for (let j = i + 1; j < suggestions.length; j++) {
        const sim = this._jaccardSimilarity(
          suggestions[i].text || suggestions[i],
          suggestions[j].text || suggestions[j]
        );
        similarities.push(sim);
      }
    }

    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const minSimilarity = Math.min(...similarities);
    const maxSimilarity = Math.max(...similarities);

    return {
      avgSimilarity: Math.round(avgSimilarity * 100) / 100,
      minSimilarity: Math.round(minSimilarity * 100) / 100,
      maxSimilarity: Math.round(maxSimilarity * 100) / 100,
      pairCount: similarities.length,
    };
  }

  /**
   * Calculate Jaccard similarity between two texts
   * @private
   */
  _jaccardSimilarity(text1, text2) {
    const set1 = new Set(String(text1).toLowerCase().split(/\s+/));
    const set2 = new Set(String(text2).toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }
}

