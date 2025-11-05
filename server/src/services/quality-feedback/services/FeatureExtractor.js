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

/**
 * Service responsible for extracting features from suggestions
 */
export class FeatureExtractor {
  /**
   * Extract all features from a suggestion
   * @param {string|Object} suggestion - The suggestion to analyze
   * @param {Object} context - Context information
   * @returns {Object} Feature vector
   */
  async extractFeatures(suggestion, context) {
    const text = typeof suggestion === 'string' ? suggestion : suggestion.text || '';

    const features = {
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

