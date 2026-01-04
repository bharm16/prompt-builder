import { logger } from '@infrastructure/Logger';
import OptimizationConfig from '@config/OptimizationConfig';
import type { AIService, OptimizationMode, QualityAssessment } from '../types';

/**
 * Service for assessing the quality of prompts
 * Evaluates clarity, specificity, structure, completeness, and actionability
 */
export class QualityAssessmentService {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'QualityAssessmentService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    
    this.log.debug('QualityAssessmentService initialized', {
      operation: 'constructor',
    });
  }

  /**
   * Assess the quality of a prompt
   */
  async assessQuality(prompt: string, mode: OptimizationMode): Promise<QualityAssessment> {
    const operation = 'assessQuality';
    const startTime = performance.now();
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      mode,
      promptLength: prompt.length,
    });

    try {
      const assessmentPrompt = this.buildAssessmentPrompt(prompt, mode);

      const response = await this.ai.execute('optimize_quality_assessment', {
        systemPrompt: assessmentPrompt,
        maxTokens: OptimizationConfig.tokens.qualityAssessment,
        temperature: OptimizationConfig.temperatures.qualityAssessment,
        timeout: OptimizationConfig.timeouts.qualityAssessment,
      });

      const rawOutput = (response.text || response.content?.[0]?.text || '').trim();
      const assessment = this.parseAssessment(rawOutput);

      const duration = Math.round(performance.now() - startTime);
      this.log.info(`${operation} completed`, {
        operation,
        duration,
        overallScore: assessment.score,
        mode,
        promptLength: prompt.length,
      });

      return assessment;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration,
        mode,
        promptLength: prompt.length,
      });
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
   */
  async identifyWeaknesses(prompt: string, assessment: QualityAssessment): Promise<string[]> {
    const operation = 'identifyWeaknesses';
    const startTime = performance.now();
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      overallScore: assessment.score,
    });
    
    const weaknesses: string[] = [];
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

    const duration = Math.round(performance.now() - startTime);
    this.log.info(`${operation} completed`, {
      operation,
      duration,
      weaknessCount: weaknesses.length,
    });

    return weaknesses;
  }

  /**
   * Build assessment prompt
   */
  private buildAssessmentPrompt(prompt: string, mode: OptimizationMode): string {
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
   */
  private getModeSpecificCriteria(_mode: OptimizationMode): string {
    return 'For video prompts, also consider: Are visual elements specific? Is cinematography style clear? Is duration/pacing specified?';
  }

  /**
   * Parse assessment from LLM response
   */
  private parseAssessment(rawOutput: string): QualityAssessment {
    let jsonText = rawOutput;

    // Remove markdown code fences if present
    const jsonMatch = rawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonText = jsonMatch[1];
    }

    try {
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
    } catch (error) {
      this.log.warn('Failed to parse assessment JSON', {
        error: (error as Error).message,
        errorName: (error as Error).name,
      });
      // Return defaults on parse failure
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
}

export default QualityAssessmentService;
