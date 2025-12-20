import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { getRubric, calculateTotalScore } from '../config/judgeRubrics';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { EvaluationContext, LLMEvaluationResult, RubricScores } from '../types';

interface Suggestion {
  text?: string;
  [key: string]: unknown;
}

interface EvaluationParams {
  suggestions: Suggestion[];
  context: EvaluationContext;
  rubricType?: 'video' | 'general';
}

interface ComparisonResult {
  setA: LLMEvaluationResult;
  setB: LLMEvaluationResult;
  winner: 'A' | 'B' | 'TIE';
  scoreDifference: number;
  criteriaComparison: Record<string, {
    setA: number;
    setB: number;
    difference: number;
    winner: 'A' | 'B' | 'TIE';
  }>;
}

type OutputSchema = {
  type: 'object' | 'array';
  required?: string[];
  items?: { required?: string[] };
} & Record<string, unknown>;

interface RubricCriterion {
  name: string;
  weight: number;
  scale: string;
  description: string;
  examples: { high: string; low: string };
  questions: string[];
}

interface RubricDefinition {
  name: string;
  description: string;
  scoringGuide: string;
  criteria: RubricCriterion[];
}

/**
 * LLMJudgeService - LLM-as-a-Judge Evaluation
 * 
 * Implements PDF Section 5.3: "LLM-as-a-Judge (Semantic Alignment)"
 * 
 * Uses a high-capability LLM (GPT-4o or Claude Sonnet) to evaluate
 * suggestion quality against research-backed rubrics.
 * 
 * This is an OPTIONAL service - only called on-demand to avoid
 * impacting standard request latency.
 * 
 * From PDF: "This tier evaluates the qualitative aspects: Does the prompt
 * sound like a director wrote it? Is it safe?"
 */
export class LLMJudgeService {
  private readonly ai: AIModelService;

  constructor(aiService: AIModelService) {
    this.ai = aiService;
  }

  /**
   * Evaluate suggestions using LLM-as-a-Judge
   */
  async evaluateSuggestions({ suggestions, context, rubricType }: EvaluationParams): Promise<LLMEvaluationResult> {
    const startTime = Date.now();

    // Auto-detect rubric type if not specified
    const rubric = (rubricType
      ? getRubric(rubricType)
      : getRubric(context.isVideoPrompt ? 'video' : 'general')) as RubricDefinition;

    logger.info('Starting LLM-as-a-Judge evaluation', {
      suggestionCount: suggestions.length,
      rubricType: rubric.name,
      isVideoPrompt: context.isVideoPrompt,
    });

    try {
      // Build evaluation prompt
      const systemPrompt = this._buildJudgePrompt(suggestions, context, rubric);

      // Define output schema
      const schema = this._getEvaluationSchema(rubric);

      // Call LLM with appropriate model for judging
      const operation = context.isVideoPrompt ? 'llm_judge_video' : 'llm_judge_general';
      
      const evaluation = await StructuredOutputEnforcer.enforceJSON<{
        rubricScores: RubricScores;
        feedback?: string[];
        strengths?: string[];
        weaknesses?: string[];
        detailedNotes?: string;
      }>(
        this.ai,
        systemPrompt,
        {
          schema,
          maxTokens: 2048,
          temperature: 0.2, // Low temperature for consistent evaluation
          operation,
        }
      );

      // Calculate total score from rubric scores
      const totalScore = calculateTotalScore(evaluation.rubricScores, rubric);

      // Add metadata
      const result: LLMEvaluationResult = {
        rubricScores: evaluation.rubricScores,
        overallScore: totalScore,
        metadata: {
          rubricUsed: rubric.name,
          evaluatedAt: new Date().toISOString(),
          suggestionCount: suggestions.length,
          evaluationTime: Date.now() - startTime,
        },
      };

      logger.info('LLM-as-a-Judge evaluation completed', {
        overallScore: totalScore,
        rubricScores: evaluation.rubricScores,
        evaluationTime: result.metadata.evaluationTime,
      });

      return result;
    } catch (error) {
      logger.error('LLM-as-a-Judge evaluation failed', error as Error);
      
      // Return fallback evaluation
      return this._getFallbackEvaluation(rubric);
    }
  }

  /**
   * Build the evaluation prompt for the judge LLM
   */
  private _buildJudgePrompt(suggestions: Suggestion[], context: EvaluationContext, rubric: RubricDefinition): string {
    const suggestionsList = suggestions
      .map((s, i) => `${i + 1}. "${s.text || s}"`)
      .join('\n');

    const criteriaDescriptions = rubric.criteria
      .map(
        (criterion: RubricCriterion) => `
**${criterion.name.toUpperCase()} (${criterion.scale})**
${criterion.description}

Questions to consider:
${criterion.questions.map((q: string) => `- ${q}`).join('\n')}

Examples:
- HIGH (4-5): ${criterion.examples.high}
- LOW (1-2): ${criterion.examples.low}
`
      )
      .join('\n---\n');

    return `You are an expert evaluator assessing the quality of text suggestions.

**CONTEXT:**
Original text: "${context.highlightedText || ''}"
${context.fullPrompt ? `Full prompt: "${context.fullPrompt.substring(0, 200)}..."` : ''}
${context.isVideoPrompt ? 'This is a VIDEO PROMPT - evaluate for cinematic quality.' : 'This is GENERAL TEXT - evaluate for clarity and coherence.'}

**SUGGESTIONS TO EVALUATE:**
${suggestionsList}

**EVALUATION RUBRIC:**
${rubric.description}

${criteriaDescriptions}

${rubric.scoringGuide}

**YOUR TASK:**
Evaluate ALL suggestions as a set against each criterion above.
Be critical but fair. Use the full 1-5 range.

Return your evaluation as JSON:
{
  "rubricScores": {
    ${rubric.criteria.map(c => `"${c.name}": 1-5`).join(',\n    ')}
  },
  "feedback": [
    "Specific improvement suggestions"
  ],
  "strengths": [
    "What works well across the suggestions"
  ],
  "weaknesses": [
    "What needs improvement"
  ],
  "detailedNotes": "Brief explanation of your scoring rationale"
}`;
  }

  /**
   * Get JSON schema for evaluation output
   */
  private _getEvaluationSchema(rubric: RubricDefinition): OutputSchema {
    const criteriaProperties: Record<string, unknown> = {};
    rubric.criteria.forEach((criterion: RubricCriterion) => {
      criteriaProperties[criterion.name] = {
        type: 'number',
        minimum: 1,
        maximum: 5,
        description: `Score for ${criterion.name} (1-5)`,
      };
    });

    return {
      type: 'object' as const,
      properties: {
        rubricScores: {
          type: 'object',
          properties: criteriaProperties,
          required: rubric.criteria.map(c => c.name),
        },
        feedback: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific improvement suggestions',
        },
        strengths: {
          type: 'array',
          items: { type: 'string' },
          description: 'What works well',
        },
        weaknesses: {
          type: 'array',
          items: { type: 'string' },
          description: 'What needs improvement',
        },
        detailedNotes: {
          type: 'string',
          description: 'Explanation of scoring rationale',
        },
      },
      required: ['rubricScores', 'feedback', 'strengths'],
    };
  }

  /**
   * Get fallback evaluation if LLM fails
   */
  private _getFallbackEvaluation(rubric: RubricDefinition): LLMEvaluationResult {
    const rubricScores: RubricScores = {};
    rubric.criteria.forEach((criterion: RubricCriterion) => {
      rubricScores[criterion.name] = 3; // Neutral score
    });

    return {
      rubricScores,
      overallScore: 60,
      metadata: {
        rubricUsed: rubric.name,
        evaluatedAt: new Date().toISOString(),
        suggestionCount: 0,
        evaluationTime: 0,
      },
    };
  }

  /**
   * Evaluate a single suggestion (for detailed analysis)
   */
  async evaluateSingleSuggestion(
    suggestion: string,
    context: EvaluationContext,
    rubricType?: 'video' | 'general'
  ): Promise<LLMEvaluationResult> {
    return this.evaluateSuggestions({
      suggestions: [{ text: suggestion }],
      context,
      ...(rubricType ? { rubricType } : {}),
    });
  }

  /**
   * Batch evaluate multiple suggestion sets
   * 
   * Useful for A/B testing or comparing different generation strategies
   */
  async batchEvaluate(
    suggestionSets: Suggestion[][],
    context: EvaluationContext,
    rubricType?: 'video' | 'general'
  ): Promise<LLMEvaluationResult[]> {
    logger.info('Starting batch LLM-as-a-Judge evaluation', {
      setCount: suggestionSets.length,
    });

    const evaluations: LLMEvaluationResult[] = [];
    
    for (let i = 0; i < suggestionSets.length; i++) {
      const evaluation = await this.evaluateSuggestions({
        suggestions: suggestionSets[i] ?? [],
        context,
        ...(rubricType ? { rubricType } : {}),
      });
      
      evaluations.push(evaluation);
    }

    logger.info('Batch evaluation completed', {
      setCount: evaluations.length,
      avgScore: evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length,
    });

    return evaluations;
  }

  /**
   * Compare two suggestion sets and provide comparative analysis
   */
  async compareSuggestionSets(
    setA: Suggestion[],
    setB: Suggestion[],
    context: EvaluationContext,
    rubricType?: 'video' | 'general'
  ): Promise<ComparisonResult> {
    const evaluations = await this.batchEvaluate([setA, setB], context, rubricType);
    const evalA = evaluations[0];
    const evalB = evaluations[1];
    if (!evalA || !evalB) {
      throw new Error('LLMJudgeService: missing evaluation results for comparison');
    }

    const rubric = (getRubric(rubricType || (context.isVideoPrompt ? 'video' : 'general')) as RubricDefinition);
    const criteriaComparison: ComparisonResult['criteriaComparison'] = {};

    // Compare each criterion
    rubric.criteria.forEach((criterion: RubricCriterion) => {
      const scoreA = evalA.rubricScores[criterion.name] ?? 0;
      const scoreB = evalB.rubricScores[criterion.name] ?? 0;
      
      criteriaComparison[criterion.name] = {
        setA: scoreA,
        setB: scoreB,
        difference: scoreA - scoreB,
        winner: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'TIE',
      };
    });

    return {
      setA: evalA,
      setB: evalB,
      winner: evalA.overallScore > evalB.overallScore ? 'A' : evalB.overallScore > evalA.overallScore ? 'B' : 'TIE',
      scoreDifference: Math.abs(evalA.overallScore - evalB.overallScore),
      criteriaComparison,
    };
  }
}
