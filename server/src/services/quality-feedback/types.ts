/**
 * Types for quality feedback services
 * Shared type definitions used across quality feedback modules
 */

/**
 * Feature vector extracted from a suggestion
 */
export interface FeatureVector {
  length: number;
  specificity: number;
  clarity: number;
  actionability: number;
  contextMatch: number;
  hasExamples: number;
  hasNumbers: number;
  hasStructure: number;
  sentenceCount: number;
  questionCount: number;
}

/**
 * Context information for feature extraction
 */
export interface FeatureContext {
  domain?: string;
  type?: string;
  expectedLength?: number;
}

/**
 * Feedback entry stored in repository
 */
export interface FeedbackEntry {
  id: string;
  suggestion: string | { text: string };
  features: FeatureVector;
  accepted: boolean;
  qualityScore: number;
  context?: FeatureContext;
  service: string;
  timestamp: number;
}

/**
 * Quality statistics for a service
 */
export interface QualityStatistics {
  totalFeedback: number;
  acceptanceRate: number;
  averageQuality: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  modelWeights?: Record<string, number>;
}

/**
 * Model weights and bias
 */
export interface ModelWeights {
  weights: Record<string, number>;
  bias: number;
}

/**
 * Evaluation context for LLM judge
 */
export interface EvaluationContext {
  highlightedText?: string;
  fullPrompt?: string;
  isVideoPrompt?: boolean;
}

/**
 * Rubric scores from LLM judge
 */
export interface RubricScores {
  [key: string]: number;
}

/**
 * LLM evaluation result
 */
export interface LLMEvaluationResult {
  rubricScores: RubricScores;
  overallScore: number;
  metadata: {
    rubricUsed: string;
    evaluatedAt: string;
    suggestionCount: number;
    evaluationTime: number;
  };
}

