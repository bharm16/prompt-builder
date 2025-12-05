import { logger } from '@infrastructure/Logger';
import { QUALITY_METRICS } from '../config/qualityMetrics.js';
import { clamp } from '../utils/statisticsHelpers.js';
import type { FeatureContext } from '../types.js';

/**
 * Service responsible for assessing quality of outputs
 */
export class QualityAssessor {
  private readonly log = logger.child({ service: 'QualityAssessor' });

  /**
   * Assess the final quality of output
   */
  async assessFinalQuality(
    finalOutput: string | null | undefined,
    context: FeatureContext | null | undefined
  ): Promise<number> {
    if (!finalOutput) return 0.5;

    // Calculate individual metrics
    const metrics = {
      completeness: this.assessCompleteness(finalOutput, context),
      correctness: this.assessCorrectness(finalOutput, context),
      usefulness: this.assessUsefulness(finalOutput, context),
      efficiency: this.assessEfficiency(finalOutput, context),
    };

    // Weight the metrics
    const qualityScore =
      metrics.completeness * QUALITY_METRICS.WEIGHTS.completeness +
      metrics.correctness * QUALITY_METRICS.WEIGHTS.correctness +
      metrics.usefulness * QUALITY_METRICS.WEIGHTS.usefulness +
      metrics.efficiency * QUALITY_METRICS.WEIGHTS.efficiency;

    return clamp(qualityScore);
  }

  /**
   * Assess completeness of output
   */
  private assessCompleteness(output: string, context: FeatureContext | null | undefined): number {
    let score = 0.5;
    const { COMPLETENESS } = QUALITY_METRICS;

    // Check if output meets minimum length expectations
    if (output.length > COMPLETENESS.MIN_LENGTH) score += 0.2;

    // Check if it has structure
    if (output.includes('\n') || output.includes('. ')) score += 0.15;

    // Check if it addresses multiple aspects
    COMPLETENESS.ASPECT_KEYWORDS.forEach(aspect => {
      if (output.toLowerCase().includes(aspect)) score += 0.05;
    });

    return Math.min(score, 1);
  }

  /**
   * Assess correctness of output
   */
  private assessCorrectness(output: string, context: FeatureContext | null | undefined): number {
    const { CORRECTNESS } = QUALITY_METRICS;
    let score = CORRECTNESS.DEFAULT_SCORE;
    const outputLower = output.toLowerCase();

    // Check for common error indicators
    CORRECTNESS.ERROR_INDICATORS.forEach(indicator => {
      if (outputLower.includes(indicator)) score -= 0.1;
    });

    // Check for success indicators
    CORRECTNESS.SUCCESS_INDICATORS.forEach(indicator => {
      if (outputLower.includes(indicator)) score += 0.05;
    });

    return clamp(score);
  }

  /**
   * Assess usefulness of output
   */
  private assessUsefulness(output: string, context: FeatureContext | null | undefined): number {
    let score = 0.5;
    const { USEFULNESS } = QUALITY_METRICS;

    // Check for practical elements
    if (output.includes('example') || output.includes('e.g.')) score += 0.15;
    if (/\d+/.test(output)) score += 0.1; // Contains numbers/data
    if (output.includes('step') || output.includes('instruction')) score += 0.15;

    // Check if it provides value beyond restating
    const uniqueWords = new Set(output.toLowerCase().split(/\s+/));
    if (uniqueWords.size > USEFULNESS.MIN_UNIQUE_WORDS) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Assess efficiency of output
   */
  private assessEfficiency(output: string, context: FeatureContext | null | undefined): number {
    const { EFFICIENCY } = QUALITY_METRICS;
    const words = output.split(/\s+/).length;
    const sentences = (output.match(/[.!?]+/g) || []).length;
    const wordsPerSentence = words / (sentences || 1);

    let score = 0.5;

    // Check ideal words per sentence
    if (wordsPerSentence >= EFFICIENCY.IDEAL_WORDS_PER_SENTENCE.min && 
        wordsPerSentence <= EFFICIENCY.IDEAL_WORDS_PER_SENTENCE.max) {
      score += 0.3;
    }

    // Check good overall length
    if (words >= EFFICIENCY.IDEAL_TOTAL_WORDS.min && 
        words <= EFFICIENCY.IDEAL_TOTAL_WORDS.max) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }
}

