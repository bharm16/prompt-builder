import { logger } from '@infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import {
  validatePromptOutputSchema,
  smartDefaultsOutputSchema,
} from '@utils/validation.js';

/**
 * Service responsible for validating prompt quality and completeness.
 * Provides quality scoring and smart default suggestions.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class PromptValidationService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Validate prompt quality and completeness
   * @param {Object} params - Validation parameters
   * @param {Object} params.elements - Scene elements
   * @param {string} params.concept - Overall concept
   * @returns {Promise<Object>} Validation results with score and feedback
   */
  async validatePrompt({ elements, concept }) {
    logger.info('Validating prompt quality');

    const prompt = `Evaluate the quality and completeness of this video prompt.

Concept: ${concept || 'Not specified'}

Elements:
${Object.entries(elements)
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
      const validation = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_prompt_validation',
          schema: validatePromptOutputSchema,
          maxTokens: 512,
          temperature: 0.3,
        }
      );
      return validation;
    } catch (error) {
      logger.error('Failed to validate prompt', { error });
      return {
        score: 50,
        breakdown: {},
        feedback: ['Unable to validate'],
        strengths: [],
        weaknesses: [],
      };
    }
  }

  /**
   * Get smart defaults for dependent elements
   * @param {Object} params - Smart defaults parameters
   * @param {string} params.elementType - Type of element
   * @param {Object} params.existingElements - Existing elements
   * @returns {Promise<Object>} Smart default suggestions
   */
  async getSmartDefaults({ elementType, existingElements }) {
    logger.info('Getting smart defaults', { elementType });

    const dependencies = Object.entries(existingElements)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    if (!dependencies) {
      return { defaults: [] };
    }

    const prompt = `Suggest smart default values for ${elementType} based on existing elements.

Existing Elements:
${dependencies}

Suggest 3 logical default values for ${elementType} that:
1. Naturally complement the existing elements
2. Maintain consistency
3. Enhance the overall concept

Return ONLY a JSON array:
["default 1", "default 2", "default 3"]`;

    try {
      const defaults = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_smart_defaults',
          schema: smartDefaultsOutputSchema,
          isArray: true,
          maxTokens: 256,
          temperature: 0.6,
        }
      );
      return { defaults };
    } catch (error) {
      logger.error('Failed to get smart defaults', { error });
      return { defaults: [] };
    }
  }
}

