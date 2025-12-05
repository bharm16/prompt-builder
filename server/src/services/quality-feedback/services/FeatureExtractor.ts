import { logger } from '@infrastructure/Logger';
import { FEATURE_WEIGHTS } from '../config/qualityMetrics.js';
import {
  calculateSpecificity,
  calculateClarity,
  calculateActionability,
  calculateContextMatch,
  normalizeLength,
  countSentences,
  countQuestions,
  hasStructure,
  hasExamples,
  hasNumbers,
} from '../utils/textAnalysis.js';
import type { FeatureVector, FeatureContext } from '../types.js';

/**
 * Service responsible for extracting features from suggestions
 */
export class FeatureExtractor {
  private readonly log = logger.child({ service: 'FeatureExtractor' });

  /**
   * Extract all features from a suggestion
   */
  async extractFeatures(
    suggestion: string | { text: string } | null | undefined,
    context: FeatureContext | null | undefined
  ): Promise<FeatureVector> {
    const text = typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

    const features: FeatureVector = {
      // Core features
      length: normalizeLength(text),
      specificity: calculateSpecificity(text),
      clarity: calculateClarity(text),
      actionability: calculateActionability(text),
      contextMatch: calculateContextMatch(text, context),

      // Additional features
      hasExamples: hasExamples(text) ? 1 : 0,
      hasNumbers: hasNumbers(text) ? 1 : 0,
      hasStructure: hasStructure(text) ? 1 : 0,
      sentenceCount: countSentences(text) / FEATURE_WEIGHTS.TEXT_ANALYSIS.SENTENCE_COUNT_DIVISOR,
      questionCount: countQuestions(text) / FEATURE_WEIGHTS.TEXT_ANALYSIS.QUESTION_COUNT_DIVISOR,
    };

    return features;
  }
}

