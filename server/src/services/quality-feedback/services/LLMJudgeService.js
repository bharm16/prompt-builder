import { logger } from '../infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '../../../utils/StructuredOutputEnforcer.js';
import { getRubric, calculateTotalScore } from '../config/judgeRubrics.js';

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
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Evaluate suggestions using LLM-as-a-Judge
   * 
   * @param {Object} params - Evaluation parameters
   * @param {Array} params.suggestions - Suggestions to evaluate
   * @param {Object} params.context - Context for evaluation
   * @param {string} params.context.highlightedText - Original text
   * @param {string} params.context.fullPrompt - Full prompt context
   * @param {boolean} params.context.isVideoPrompt - Video prompt flag
   * @param {string} params.rubricType - 'video' or 'general' (auto-detected if not provided)
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateSuggestions({ suggestions, context, rubricType }) {
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
      );

      // Calculate total score from rubric scores
      const totalScore = calculateTotalScore(evaluation.rubricScores, rubric);
      evaluation.overallScore = totalScore;

      // Add metadata
      evaluation.metadata = {
        rubricUsed: rubric.name,
        evaluatedAt: new Date().toISOString(),
        suggestionCount: suggestions.length,
        evaluationTime: Date.now() - startTime,
      };

      logger.info('LLM-as-a-Judge evaluation completed', {
        overallScore: totalScore,
        rubricScores: evaluation.rubricScores,
        evaluationTime: evaluation.metadata.evaluationTime,
      });

      return evaluation;
    } catch (error) {
      logger.error('LLM-as-a-Judge evaluation failed', { error });
      
      // Return fallback evaluation
      return this._getFallbackEvaluation(rubric);
    }
  }

  /**
   * Build the evaluation prompt for the judge LLM
   * @private
   */
  _buildJudgePrompt(suggestions, context, rubric) {
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
Original text: "${context.highlightedText}"
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
   * @private
   */
  _getEvaluationSchema(rubric) {
    const criteriaProperties = {};
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
   * @private
   */
  _getFallbackEvaluation(rubric) {
    const rubricScores = {};
    rubric.criteria.forEach(criterion => {
      rubricScores[criterion.name] = 3; // Neutral score
    });

    return {
      overallScore: 60,
      rubricScores,
      feedback: ['Unable to complete automated evaluation'],
      strengths: [],
      weaknesses: [],
      detailedNotes: 'Fallback evaluation due to service unavailability',
      metadata: {
        rubricUsed: rubric.name,
        evaluatedAt: new Date().toISOString(),
        fallback: true,
      },
    };
  }

  /**
   * Evaluate a single suggestion (for detailed analysis)
   * 
   * @param {string} suggestion - Single suggestion text
   * @param {Object} context - Context for evaluation
   * @param {string} rubricType - 'video' or 'general'
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateSingleSuggestion(suggestion, context, rubricType) {
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
   * 
   * @param {Array} suggestionSets - Array of suggestion arrays
   * @param {Object} context - Shared context
   * @param {string} rubricType - 'video' or 'general'
   * @returns {Promise<Array>} Array of evaluation results
   */
  async batchEvaluate(suggestionSets, context, rubricType) {
    logger.info('Starting batch LLM-as-a-Judge evaluation', {
      setCount: suggestionSets.length,
    });

    const evaluations = [];
    
    for (let i = 0; i < suggestionSets.length; i++) {
      const evaluation = await this.evaluateSuggestions({
        suggestions: suggestionSets[i],
        context,
        rubricType,
      });
      
      evaluation.setIndex = i;
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
   * 
   * @param {Array} setA - First suggestion set
   * @param {Array} setB - Second suggestion set
   * @param {Object} context - Evaluation context
   * @param {string} rubricType - 'video' or 'general'
   * @returns {Promise<Object>} Comparative evaluation
   */
  async compareSuggestionSets(setA, setB, context, rubricType) {
    const [evalA, evalB] = await this.batchEvaluate([setA, setB], context, rubricType);

    const comparison = {
      setA: evalA,
      setB: evalB,
      winner: evalA.overallScore > evalB.overallScore ? 'A' : evalB.overallScore > evalA.overallScore ? 'B' : 'TIE',
      scoreDifference: Math.abs(evalA.overallScore - evalB.overallScore),
      criteriaComparison: {},
    };

    // Compare each criterion
    const rubric = getRubric(rubricType || (context.isVideoPrompt ? 'video' : 'general'));
    rubric.criteria.forEach(criterion => {
      const scoreA = evalA.rubricScores[criterion.name];
      const scoreB = evalB.rubricScores[criterion.name];
      
      comparison.criteriaComparison[criterion.name] = {
        setA: scoreA,
        setB: scoreB,
        difference: scoreA - scoreB,
        winner: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'TIE',
      };
    });

    return comparison;
  }
}

