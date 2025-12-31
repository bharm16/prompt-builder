import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { detectProvider, type ProviderType } from '@utils/provider/ProviderDetector';
import type {
  Suggestion,
  AIService,
  ContrastiveDecodingContext,
  DiversityMetrics,
  OutputSchema,
} from './types.js';

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
  private readonly config: {
    batchSizes: number[];
    temperatures: number[];
    enabled: boolean;
  };

  constructor(private readonly ai: AIService) {
    // Configuration optimized for Llama 3.1 8B
    // IMPORTANT: 8B models are "quite sensitive to temperature" (Groq docs)
    // We use lower temperatures for reliable JSON output
    // Diversity comes from negative constraints, not high temperature
    this.config = {
      batchSizes: [4, 4, 4], // Total: 12 suggestions
      temperatures: [0.4, 0.5, 0.6], // Lower temps for reliable output
      enabled: true,
    };
  }

  /**
   * Generate diverse suggestions using contrastive decoding approach
   * 
   * @param context - Generation context
   * @returns Array of diverse suggestions or null to use standard generation
   */
  async generateWithContrastiveDecoding(context: ContrastiveDecodingContext): Promise<Suggestion[] | null> {
    const startTime = Date.now();
    
    if (!this.shouldUseContrastiveDecoding(context)) {
      logger.debug('Contrastive decoding not needed for this context');
      return null; // Signal to use standard generation
    }

    const routing = this._getEnhancementRouting();

    logger.info('Using contrastive decoding for enhanced diversity', {
      isVideoPrompt: context.isVideoPrompt,
      highlightedText: context.highlightedText?.substring(0, 50),
    });

    try {
      const allSuggestions: Suggestion[] = [];
      
      // Batch 1: Standard temperature, no constraints
      const batch1 = await this._generateBatch({
        ...context,
        temperature: this.config.temperatures[0]!,
        count: this.config.batchSizes[0]!,
        negativeConstraint: null,
        batchNumber: 1,
        provider: routing.provider,
        model: routing.model,
      });
      allSuggestions.push(...batch1);
      
      // Batch 2: Higher temperature, constrain against Batch 1
      const batch2 = await this._generateBatch({
        ...context,
        temperature: this.config.temperatures[1]!,
        count: this.config.batchSizes[1]!,
        negativeConstraint: this._buildNegativeConstraint(batch1),
        batchNumber: 2,
        provider: routing.provider,
        model: routing.model,
      });
      allSuggestions.push(...batch2);
      
      // Batch 3: Highest temperature, constrain against Batches 1+2
      const batch3 = await this._generateBatch({
        ...context,
        temperature: this.config.temperatures[2]!,
        count: this.config.batchSizes[2]!,
        negativeConstraint: this._buildNegativeConstraint([...batch1, ...batch2]),
        batchNumber: 3,
        provider: routing.provider,
        model: routing.model,
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
      logger.error(
        'Contrastive decoding failed, will fallback to standard generation',
        error as Error
      );
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
   * @param context - Generation context
   * @returns True if contrastive decoding should be used
   */
  shouldUseContrastiveDecoding(context: ContrastiveDecodingContext): boolean {
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
   * @param params - Batch generation parameters
   * @returns Batch of suggestions
   * @private
   */
  private async _generateBatch(params: {
    systemPrompt: string;
    schema: OutputSchema;
    temperature: number;
    count: number;
    negativeConstraint: string | null;
    batchNumber: number;
    provider: ProviderType;
    model?: string;
  }): Promise<Suggestion[]> {
    const {
      systemPrompt,
      schema,
      temperature,
      count,
      negativeConstraint,
      batchNumber,
      provider,
      model,
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
          provider,
          model,
        }
      ) as Suggestion[];

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
      logger.error(`Failed to generate batch ${batchNumber}`, error as Error);
      throw error;
    }
  }

  private _getEnhancementRouting(): { provider: ProviderType; model?: string } {
    const config = this.ai.getOperationConfig('enhance_suggestions');
    return {
      provider: detectProvider({ client: config.client, model: config.model }),
      model: config.model,
    };
  }

  /**
   * Build negative constraint text from previous suggestions
   * 
   * Per PDF Section 6.3:
   * "Generate the next 4 with a higher temperature and a Negative Constraint:
   * 'Do not use concepts related to [List of first 4 options].'"
   * 
   * @param previousSuggestions - Previous batch(es) of suggestions
   * @returns Negative constraint text
   * @private
   */
  private _buildNegativeConstraint(previousSuggestions: Suggestion[]): string | null {
    if (!previousSuggestions || previousSuggestions.length === 0) {
      return null;
    }

    const previousTexts = previousSuggestions
      .map(s => s.text || String(s))
      .filter(Boolean)
      .map(text => `"${text}"`)
      .join(', ');

    return `Do not use concepts, phrases, or visual approaches similar to: ${previousTexts}`;
  }

  /**
   * Augment system prompt with negative constraint
   * 
   * SIMPLIFIED for 8B models - short, direct instruction
   * 
   * @param basePrompt - Original system prompt
   * @param constraint - Negative constraint to add
   * @returns Augmented prompt
   * @private
   */
  private _augmentPromptWithConstraint(basePrompt: string, constraint: string): string {
    if (!constraint) {
      return basePrompt;
    }

    // Simple, direct constraint for 8B model
    // Don't add verbose instructions - just the rule
    return `${basePrompt}\n\nAVOID: ${constraint}\nGenerate completely different options.`;
  }

  /**
   * Calculate diversity metrics for evaluation
   * 
   * Measures how well contrastive decoding achieved diversity goals
   * Uses Jaccard similarity (same as existing SuggestionDeduplicator)
   * 
   * @param suggestions - All generated suggestions
   * @returns Diversity metrics
   */
  calculateDiversityMetrics(suggestions: Suggestion[]): DiversityMetrics {
    if (!suggestions || suggestions.length < 2) {
      return { avgSimilarity: 0, minSimilarity: 0, maxSimilarity: 0 };
    }

    const similarities: number[] = [];
    
    for (let i = 0; i < suggestions.length; i++) {
      for (let j = i + 1; j < suggestions.length; j++) {
        const sim = this._jaccardSimilarity(
          suggestions[i]!.text || String(suggestions[i]),
          suggestions[j]!.text || String(suggestions[j])
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
  private _jaccardSimilarity(text1: string, text2: string): number {
    const set1 = new Set(String(text1).toLowerCase().split(/\s+/));
    const set2 = new Set(String(text2).toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }
}
