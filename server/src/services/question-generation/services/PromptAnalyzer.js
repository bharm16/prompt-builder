import { logger } from '../../../infrastructure/Logger.js';
import {
  AMBIGUOUS_TERMS,
  TECHNICAL_PATTERNS,
  VAGUE_PATTERNS,
  COMPLEXITY_WEIGHTS,
  QUESTION_COUNT_THRESHOLDS,
  AMBIGUITY_SCORES,
  NORMALIZATION_FACTORS,
} from '../config/analysisPatterns.js';

/**
 * PromptAnalyzer - Analyzes prompt characteristics
 * 
 * Assesses complexity, ambiguity, and determines optimal question count
 * for generating context-gathering questions.
 */
export class PromptAnalyzer {
  /**
   * Determine optimal question count based on prompt complexity
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<number>} Recommended number of questions
   */
  async determineQuestionCount(prompt) {
    const complexity = await this.assessComplexity(prompt);
    const ambiguity = await this.measureAmbiguity(prompt);

    logger.debug('Prompt assessment', { complexity, ambiguity });

    // Find matching threshold
    for (const threshold of QUESTION_COUNT_THRESHOLDS) {
      if (complexity >= threshold.minComplexity || ambiguity >= threshold.minAmbiguity) {
        return threshold.questionCount;
      }
    }

    // Fallback (should not reach here due to thresholds)
    return 2;
  }

  /**
   * Assess complexity of a prompt
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<number>} Complexity score (0-1)
   */
  async assessComplexity(prompt) {
    const factors = {
      length: Math.min(prompt.length / NORMALIZATION_FACTORS.promptLength, 1),
      technicalTerms: this.countTechnicalTerms(prompt) / NORMALIZATION_FACTORS.technicalTerms,
      multiPart: (prompt.match(/\band\b|\bor\b|\balso\b/gi) || []).length / NORMALIZATION_FACTORS.multiPartIndicators,
      questions: (prompt.match(/\?/g) || []).length / NORMALIZATION_FACTORS.questionMarks,
    };

    // Apply configured weights
    const complexity =
      factors.length * COMPLEXITY_WEIGHTS.length +
      factors.technicalTerms * COMPLEXITY_WEIGHTS.technicalTerms +
      factors.multiPart * COMPLEXITY_WEIGHTS.multiPart +
      factors.questions * COMPLEXITY_WEIGHTS.questions;

    return Math.min(complexity, 1);
  }

  /**
   * Measure ambiguity in a prompt
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<number>} Ambiguity score (0-1)
   */
  async measureAmbiguity(prompt) {
    let ambiguityScore = 0;
    const promptLower = prompt.toLowerCase();

    // Check for ambiguous terms
    AMBIGUOUS_TERMS.forEach(term => {
      if (promptLower.includes(term)) {
        ambiguityScore += AMBIGUITY_SCORES.ambiguousTerm;
      }
    });

    // Check for vague verb patterns
    const vagueMatches = prompt.match(VAGUE_PATTERNS.vagueVerbs) || [];
    ambiguityScore += vagueMatches.length * AMBIGUITY_SCORES.vaguePattern;

    // Check for missing specifics
    const missingMatches = prompt.match(VAGUE_PATTERNS.missingSpecifics) || [];
    ambiguityScore += missingMatches.length * AMBIGUITY_SCORES.missingSpecific;

    return Math.min(ambiguityScore, 1);
  }

  /**
   * Count technical terms in prompt
   * @param {string} prompt - The prompt to analyze
   * @returns {number} Count of technical terms
   */
  countTechnicalTerms(prompt) {
    let count = 0;

    TECHNICAL_PATTERNS.forEach(pattern => {
      const matches = prompt.match(pattern) || [];
      count += matches.length;
    });

    return count;
  }
}

