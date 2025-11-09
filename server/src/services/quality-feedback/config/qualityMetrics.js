/**
 * Configuration for quality assessment metrics
 */

export const QUALITY_METRICS = {
  // Final quality assessment weights
  WEIGHTS: {
    completeness: 0.3,
    correctness: 0.3,
    usefulness: 0.25,
    efficiency: 0.15,
  },

  // Completeness thresholds
  COMPLETENESS: {
    MIN_LENGTH: 50,
    ASPECT_KEYWORDS: ['what', 'why', 'how', 'when', 'where'],
  },

  // Correctness indicators
  CORRECTNESS: {
    DEFAULT_SCORE: 0.7,
    ERROR_INDICATORS: ['error', 'failed', 'undefined', 'null', 'exception'],
    SUCCESS_INDICATORS: ['success', 'complete', 'done', 'working', 'fixed'],
  },

  // Usefulness criteria
  USEFULNESS: {
    MIN_UNIQUE_WORDS: 20,
  },

  // Efficiency thresholds
  EFFICIENCY: {
    IDEAL_WORDS_PER_SENTENCE: { min: 10, max: 30 },
    IDEAL_TOTAL_WORDS: { min: 20, max: 500 },
  },
};

export const FEATURE_WEIGHTS = {
  // Text analysis thresholds
  TEXT_ANALYSIS: {
    MAX_LENGTH_NORMALIZED: 200,
    SENTENCE_COUNT_DIVISOR: 10,
    QUESTION_COUNT_DIVISOR: 5,
  },

  // Clarity thresholds
  CLARITY: {
    BASE_SCORE: 0.5,
    IDEAL_LENGTH: { min: 20, max: 500 },
    MAX_AVG_WORD_LENGTH: 10,
    IDEAL_AVG_SENTENCE_LENGTH: 100,
  },

  // Context matching
  CONTEXT_MATCH: {
    DEFAULT_SCORE: 0.5,
    LENGTH_RATIO: { min: 0.7, max: 1.5 },
  },
};

