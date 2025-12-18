/**
 * Types for LLM-as-a-Judge evaluation
 */

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
