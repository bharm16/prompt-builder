/**
 * Grammatical Analysis Configuration
 * 
 * Configuration for the grammatical analysis system that handles complex span enhancement.
 * This includes sigmoid-based complexity scoring, retry parameters, and routing thresholds.
 */

interface ComplexityWeights {
  verbDensity: number;
  clauseDepth: number;
  modifierDensity: number;
  structuralDepth: number;
}

interface SigmoidParams {
  k: number;
  x0: number;
}

interface RetryConfig {
  maxAttempts: number;
  initialTemperature: number;
  initialStrictness: number;
}

interface ValidationRule {
  requiresGerundStart?: boolean;
  requiresPrepositionStart?: boolean;
  requiresVerbPresence?: boolean;
  correctionMessage: string;
}

interface ValidationRules {
  gerund_phrase: ValidationRule;
  prepositional_phrase: ValidationRule;
  complex_clause: ValidationRule;
}

interface FallbackConfig {
  enableVerbIntensification: boolean;
  enableAdjectiveExpansion: boolean;
  maxTransformations: number;
}

interface GrammaticalConfig {
  weights: ComplexityWeights;
  sigmoid: SigmoidParams;
  complexityThreshold: number;
  retry: RetryConfig;
  complexStructures: readonly string[];
  validation: ValidationRules;
  fallback: FallbackConfig;
}

export const GRAMMATICAL_CONFIG: GrammaticalConfig = {
  /**
   * Weights for complexity calculation
   * Each feature contributes to the raw complexity score
   */
  weights: {
    verbDensity: 1.2,      // Weight for verb-to-word ratio
    clauseDepth: 1.5,      // Weight for clause nesting
    modifierDensity: 0.8,  // Weight for adjective/adverb density
    structuralDepth: 2.0,  // Weight for structural complexity (prepositions, subordination)
  },

  /**
   * Sigmoid curve parameters for normalization
   * Formula: 1 / (1 + e^(-k * (x - x0)))
   * 
   * - k: Steepness of the curve (higher = sharper transition)
   * - x0: Midpoint/inflection point of the curve
   */
  sigmoid: {
    k: 2,      // Steepness factor
    x0: 2.5,   // Tipping point value
  },

  /**
   * Complexity threshold for routing decision
   * Spans with complexity > threshold go to complex handling path
   * Range: 0.0 to 1.0 (sigmoid output)
   */
  complexityThreshold: 0.6,

  /**
   * Retry configuration for resilient generation
   */
  retry: {
    maxAttempts: 3,           // Maximum retry attempts
    initialTemperature: 0.9,  // Starting temperature (hot)
    initialStrictness: 0.5,   // Starting strictness level (0.0 to 1.0)
  },

  /**
   * Structure types that always route to complex handling
   * Regardless of complexity score
   */
  complexStructures: ['gerund_phrase', 'complex_clause'],

  /**
   * Validation rules for structure enforcement
   */
  validation: {
    gerund_phrase: {
      requiresGerundStart: true,
      correctionMessage: 'The phrase MUST start with an -ing verb form (e.g., "cascading", "glimmering").',
    },
    prepositional_phrase: {
      requiresPrepositionStart: true,
      correctionMessage: 'The phrase MUST start with a preposition (e.g., "in", "under", "through").',
    },
    complex_clause: {
      requiresVerbPresence: true,
      correctionMessage: 'Complex clauses MUST contain at least one verb.',
    },
  },

  /**
   * Fallback transformation configuration
   * Controls safe algorithmic transformations when LLM fails
   */
  fallback: {
    enableVerbIntensification: true,    // Convert verbs to continuous aspect
    enableAdjectiveExpansion: true,     // Apply comparative forms
    maxTransformations: 2,              // Limit number of transformations
  },
};

/**
 * Retry parameters
 */
export interface RetryParams {
  temperature: number;
  strictness: number;
}

/**
 * Calculate retry parameters for a given attempt
 */
export function calculateRetryParams(attempt: number, maxAttempts: number): RetryParams {
  return {
    // Harmonic decay: 1.0 -> 0.5 -> 0.33
    temperature: GRAMMATICAL_CONFIG.retry.initialTemperature / (1 + attempt),
    // Linear ramp: 0.5 -> 0.75 -> 1.0
    strictness: GRAMMATICAL_CONFIG.retry.initialStrictness + 
                (0.5 * (attempt / maxAttempts)),
  };
}

/**
 * Check if a structure type requires complex handling
 */
export function isComplexStructure(structure: string): boolean {
  return GRAMMATICAL_CONFIG.complexStructures.includes(structure);
}

/**
 * Get validation rules for a specific structure
 */
export function getValidationRules(structure: string): ValidationRule | null {
  return GRAMMATICAL_CONFIG.validation[structure as keyof ValidationRules] || null;
}

