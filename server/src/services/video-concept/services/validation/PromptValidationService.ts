import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { AIService } from '@services/prompt-optimization/types';

/**
 * Validation breakdown
 */
export interface ValidationBreakdown {
  completeness: number;
  specificity: number;
  coherence: number;
  visualPotential: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  score: number;
  breakdown: ValidationBreakdown;
  feedback: string[];
  strengths: string[];
  weaknesses: string[];
}

/**
 * Service responsible for validating prompt quality and completeness.
 * Provides quality scoring and smart default suggestions.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class PromptValidationService {
  private readonly ai: AIService;
  private readonly log: ILogger;

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.log = logger.child({ service: 'PromptValidationService' });
  }

  /**
   * Validate prompt quality and completeness
   */
  async validatePrompt(params: {
    elements: Record<string, string>;
    concept?: string;
  }): Promise<ValidationResult> {
    const startTime = performance.now();
    const operation = 'validatePrompt';
    
    this.log.debug('Starting operation.', {
      operation,
      elementCount: Object.keys(params.elements).length,
      hasConcept: !!params.concept,
    });

    const prompt = `Evaluate the quality and completeness of this video prompt.

Concept: ${params.concept || 'Not specified'}

Elements:
${Object.entries(params.elements)
  .map(([k, v]) => `${k}: ${v || '(empty)'}`)
  .join('\n')}

Evaluate:
1. Completeness (0-30 points): How many elements are filled?
2. Specificity (0-25 points): How detailed and specific are the elements?
3. Coherence (0-25 points): How well do elements work together?
4. Visual Potential (0-20 points): How visually compelling is this concept?

Return ONLY a JSON object:
{
  "score": total score 0-100,
  "breakdown": {
    "completeness": 0-30,
    "specificity": 0-25,
    "coherence": 0-25,
    "visualPotential": 0-20
  },
  "feedback": ["specific improvement suggestions"],
  "strengths": ["what works well"],
  "weaknesses": ["what needs work"]
}`;

    try {
      const schema: { type: 'object' | 'array'; required?: string[] } = {
        type: 'object' as const,
        required: ['score', 'breakdown', 'feedback', 'strengths', 'weaknesses'],
      };
      
      const validation = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_prompt_validation',
          schema,
          maxTokens: 512,
          temperature: 0.3,
        }
      ) as ValidationResult;
      
      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        score: validation.score,
        feedbackCount: validation.feedback.length,
      });
      
      return validation;
    } catch (error) {
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return {
        score: 50,
        breakdown: {
          completeness: 0,
          specificity: 0,
          coherence: 0,
          visualPotential: 0,
        },
        feedback: ['Unable to validate'],
        strengths: [],
        weaknesses: [],
      };
    }
  }

  /**
   * Get smart defaults for dependent elements
   */
  async getSmartDefaults(params: {
    elementType: string;
    existingElements: Record<string, string>;
  }): Promise<{ defaults: string[] }> {
    const startTime = performance.now();
    const operation = 'getSmartDefaults';
    
    this.log.debug('Starting operation.', {
      operation,
      elementType: params.elementType,
      existingElementCount: Object.keys(params.existingElements).length,
    });

    const dependencies = Object.entries(params.existingElements)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    if (!dependencies) {
      this.log.debug('Operation skipped.', {
        operation,
        reason: 'no_dependencies',
        duration: Math.round(performance.now() - startTime),
      });
      return { defaults: [] };
    }

    const prompt = `Suggest smart default values for ${params.elementType} based on existing elements.

Existing Elements:
${dependencies}

Suggest 3 logical default values for ${params.elementType} that:
1. Naturally complement the existing elements
2. Maintain consistency
3. Enhance the overall concept

Return ONLY a JSON array:
["default 1", "default 2", "default 3"]`;

    try {
      const schema: { type: 'object' | 'array'; items?: { required?: string[] } } = {
        type: 'array' as const,
      };
      
      const defaults = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_smart_defaults',
          schema,
          isArray: true,
          maxTokens: 256,
          temperature: 0.6,
        }
      ) as string[];
      
      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        defaultCount: defaults.length,
      });
      
      return { defaults };
    } catch (error) {
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        elementType: params.elementType,
      });
      return { defaults: [] };
    }
  }
}
