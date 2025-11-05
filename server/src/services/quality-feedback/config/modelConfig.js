/**
 * Configuration for the quality feedback machine learning model
 */

export const MODEL_CONFIG = {
  // Initial model weights
  DEFAULT_WEIGHTS: {
    length: 0.1,
    specificity: 0.25,
    clarity: 0.2,
    actionability: 0.25,
    contextMatch: 0.2,
  },

  // Model bias
  DEFAULT_BIAS: 0.5,

  // Learning parameters
  LEARNING_RATE: 0.1,
  MIN_DATA_POINTS: 10,

  // Storage limits
  MAX_FEEDBACK_PER_SERVICE: 1000,
};

