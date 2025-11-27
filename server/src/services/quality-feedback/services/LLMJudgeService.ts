import { logger } from '@infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { getRubric, calculateTotalScore } from '../config/judgeRubrics.js';
import type { EvaluationContext, LLMEvaluationResult, RubricScores } from '../types.js';

interface AIService {
  // Minimal interface - actual implementation may vary
  [key: string]: unknown;
}

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
  private readonly ai: AIService;

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  /**
   * Evaluate suggestions using LLM-as-a-Judge
   */
  async evaluateSuggestions({ suggestions, context, rubricType }: EvaluationParams): Promise<LLMEvaluationResult> {
    const startTime = Date.now();

    // Auto-detect rubric type if not specified
    const rubric = rubricType
      ? getRubric(rubricType)
      : getRubric(context.isVideoPrompt ? 'video' : 'general');

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
      
      const evaluation = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        systemPrompt,
        {
          schema,
          maxTokens: 2048,
          temperature: 0.2, // Low temperature for consistent evaluation
          operation,
        }
      ) as { rubricScores: RubricScores; feedback?: string[]; strengths?: string[]; weaknesses?: string[]; detailedNotes?: string };

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
      logger.error('LLM-as-a-Judge evaluation failed', { error });
      
      // Return fallback evaluation
      return this._getFallbackEvaluation(rubric);
    }
  }

  /**
   * Build the evaluation prompt for the judge LLM
   */
  private _buildJudgePrompt(suggestions: Suggestion[], context: EvaluationContext, rubric: ReturnType<typeof getRubric>): string {
    const suggestionsList = suggestions
      .map((s, i) => `${i + 1}. "${s.text || s}"`)
      .join('\n');

    const criteriaDescriptions = rubric.criteria
      .map(
        criterion => `
**${criterion.name.toUpperCase()} (${criterion.scale})**
${criterion.description}

Questions to consider:
${criterion.questions.map(q => `- ${q}`).join('\n')}

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
  private _getEvaluationSchema(rubric: ReturnType<typeof getRubric>): Record<string, unknown> {
    const criteriaProperties: Record<string, unknown> = {};
    rubric.criteria.forEach(criterion => {
      criteriaProperties[criterion.name] = {
        type: 'number',
        minimum: 1,
        maximum: 5,
        description: `Score for ${criterion.name} (1-5)`,
      };
    });

    return {
      type: 'object',
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
  private _getFallbackEvaluation(rubric: ReturnType<typeof getRubric>): LLMEvaluationResult {
    const rubricScores: RubricScores = {};
    rubric.criteria.forEach(criterion => {
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
      rubricType,
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
        suggestions: suggestionSets[i],
        context,
        rubricType,
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
    const [evalA, evalB] = await this.batchEvaluate([setA, setB], context, rubricType);

    const rubric = getRubric(rubricType || (context.isVideoPrompt ? 'video' : 'general'));
    const criteriaComparison: ComparisonResult['criteriaComparison'] = {};

    // Compare each criterion
    rubric.criteria.forEach(criterion => {
      const scoreA = evalA.rubricScores[criterion.name];
      const scoreB = evalB.rubricScores[criterion.name];
      
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

