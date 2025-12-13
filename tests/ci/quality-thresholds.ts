export const QUALITY_THRESHOLDS = {
  spanLabeling: {
    // Hard gates
    jsonValidityRate: 0.995,
    safetyPassRate: 1.0,

    // Targets (not hard gates unless you choose to enforce)
    relaxedF1: 0.85,
    taxonomyAccuracy: 0.9,
    fragmentationRateMax: 0.2,
    overExtractionRateMax: 0.15,
    regressionTolerance: 0.02,
  },
  suggestions: {
    // Targets
    categoryCoherence: 0.9,
    diversity: 0.5,
    nonRepetition: 0.6,
    syntacticValidity: 0.95,
    lengthAppropriateness: 0.8,
    regressionTolerance: 0.05,
  },
  optimization: {
    // Hard gate
    intentPreservation: 1.0,

    // Targets
    structuralCompleteness: 0.75,
    wordCountCompliance: 0.8,
    technicalDensity: 0.7,
    modelCompliance: 0.85,
    regressionTolerance: 0.05,
  },
} as const;

export const METRIC_DIRECTIONS = {
  spanLabeling: {
    jsonValidityRate: 'up',
    safetyPassRate: 'up',
    relaxedF1: 'up',
    taxonomyAccuracy: 'up',
    fragmentationRate: 'down',
    overExtractionRate: 'down',
  },
  suggestions: {
    categoryCoherence: 'up',
    diversity: 'up',
    nonRepetition: 'up',
    syntacticValidity: 'up',
    lengthAppropriateness: 'up',
  },
  optimization: {
    intentPreservation: 'up',
    structuralCompleteness: 'up',
    wordCountCompliance: 'up',
    technicalDensity: 'up',
    modelCompliance: 'up',
  },
} as const;
