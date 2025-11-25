import { logger } from '../../infrastructure/Logger.ts';
import OptimizationConfig from '../../../config/OptimizationConfig.js';

/**
 * Service for assessing the quality of prompts
 * Evaluates clarity, specificity, structure, completeness, and actionability
 */
export class QualityAssessmentService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Assess the quality of a prompt
   * @param {string} prompt - The prompt to assess
   * @param {string} mode - The optimization mode
   * @returns {Promise<Object>} Assessment with score and details
   */
  async assessQuality(prompt, mode) {
    logger.info('Assessing prompt quality', { mode, promptLength: prompt.length });

    try {
      const assessmentPrompt = this.buildAssessmentPrompt(prompt, mode);

      const response = await this.ai.execute('optimize_quality_assessment', {
        systemPrompt: assessmentPrompt,
        maxTokens: OptimizationConfig.tokens.qualityAssessment,
        temperature: OptimizationConfig.temperatures.qualityAssessment,
        timeout: OptimizationConfig.timeouts.qualityAssessment,
      });

      const rawOutput = response.content[0].text.trim();
      const assessment = this.parseAssessment(rawOutput);

      logger.info('Quality assessment complete', {
        overallScore: assessment.score,
        mode
      });

      return assessment;
    } catch (error) {
      logger.error('Quality assessment failed', { error: error.message });
      // Return neutral assessment on failure
      return {
        score: 0.7,
        details: {
          clarity: 0.7,
          specificity: 0.7,
          structure: 0.7,
          completeness: 0.7,
          actionability: 0.7,
        },
        strengths: [],
        weaknesses: []
      };
    }
  }

  /**
   * Identify specific weaknesses in a prompt
   * @param {string} prompt - The prompt to analyze
   * @param {Object} assessment - Previous assessment results
   * @returns {Array<string>} List of improvement suggestions
   */
  async identifyWeaknesses(prompt, assessment) {
    const weaknesses = [];
    const thresholds = OptimizationConfig.quality.componentThresholds;

    if (assessment.details.clarity < thresholds.clarity) {
      weaknesses.push('Lacks clarity - vague or ambiguous phrasing');
    }
    if (assessment.details.specificity < thresholds.specificity) {
      weaknesses.push('Too generic - needs more specific details and constraints');
    }
    if (assessment.details.structure < thresholds.structure) {
      weaknesses.push('Poor structure - difficult to follow or disorganized');
    }
    if (assessment.details.completeness < thresholds.completeness) {
      weaknesses.push('Incomplete - missing important context or requirements');
    }
    if (assessment.details.actionability < thresholds.actionability) {
      weaknesses.push('Low actionability - unclear what output or action is needed');
    }

    return weaknesses;
  }

  /**
   * Build assessment prompt
   * @private
   */
  buildAssessmentPrompt(prompt, mode) {
    const modeSpecificCriteria = this.getModeSpecificCriteria(mode);

    return `Assess the quality of this ${mode} prompt across key dimensions.

<prompt_to_assess>
${prompt}
</prompt_to_assess>

Evaluate on these dimensions (0.0-1.0 scale):

1. **Clarity** (0.0-1.0): Is the objective clear and unambiguous?
2. **Specificity** (0.0-1.0): Are requirements specific vs. generic?
3. **Structure** (0.0-1.0): Is it well-organized and easy to follow?
4. **Completeness** (0.0-1.0): Does it include necessary context and constraints?
5. **Actionability** (0.0-1.0): Is it clear what output/action is needed?

${modeSpecificCriteria}

Output ONLY a JSON object:

{
  "clarity": 0.0-1.0,
  "specificity": 0.0-1.0,
  "structure": 0.0-1.0,
  "completeness": 0.0-1.0,
  "actionability": 0.0-1.0,
  "overallScore": 0.0-1.0,
  "strengths": ["brief strength 1", "brief strength 2"],
  "weaknesses": ["brief weakness 1", "brief weakness 2"]
}

Output only the JSON, nothing else:`;
  }

  /**
   * Get mode-specific quality criteria
   * @private
   */
  getModeSpecificCriteria(mode) {
    const criteria = {
      reasoning: 'For reasoning prompts, also consider: Are deliverables specific? Are warnings domain-specific? Is context sufficient?',
      research: 'For research prompts, also consider: Is research scope clear? Are source requirements specified? Are success metrics defined?',
      socratic: 'For learning prompts, also consider: Is learning objective clear? Is difficulty appropriate? Are prerequisitesidentified?',
      video: 'For video prompts, also consider: Are visual elements specific? Is cinematography style clear? Is duration/pacing specified?',
      optimize: 'For general optimization, ensure the improved version addresses the core intent with better structure and clarity.'
    };

    return criteria[mode] || criteria.optimize;
  }

  /**
   * Parse assessment from LLM response
   * @private
   */
  parseAssessment(rawOutput) {
    let jsonText = rawOutput;

    // Remove markdown code fences if present
    const jsonMatch = rawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    return {
      score: parsed.overallScore || 0.7,
      details: {
        clarity: parsed.clarity || 0.7,
        specificity: parsed.specificity || 0.7,
        structure: parsed.structure || 0.7,
        completeness: parsed.completeness || 0.7,
        actionability: parsed.actionability || 0.7,
      },
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || []
    };
  }
}

export default QualityAssessmentService;

