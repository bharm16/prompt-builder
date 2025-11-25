import { logger } from '../../../../infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '../../../../utils/StructuredOutputEnforcer.js';
import { completeSceneOutputSchema } from '../../../../utils/validation.js';

/**
 * Service responsible for completing video scenes by filling empty elements.
 * Suggests values for missing elements based on existing context.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class SceneCompletionService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Complete scene by suggesting all empty elements
   * @param {Object} params - Completion parameters
   * @param {Object} params.existingElements - Elements with some values filled
   * @param {string} params.concept - Overall concept
   * @returns {Promise<Object>} Completed elements
   */
  async completeScene({ existingElements, concept }) {
    logger.info('Completing scene with AI suggestions');

    const emptyElements = Object.entries(existingElements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyElements.length === 0) {
      return { suggestions: existingElements };
    }

    const prompt = `Complete this video scene by filling in the missing elements.

Concept: ${concept || 'Not specified'}

Existing Elements:
${Object.entries(existingElements)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Missing Elements to Fill:
${emptyElements.join(', ')}

Requirements:
1. Ensure all suggestions work harmoniously with existing elements
2. Maintain thematic consistency
3. Create a cohesive, compelling scene
4. Be specific and visual

Return ONLY a JSON object with the missing elements:
{
  "${emptyElements[0]}": "specific suggestion",
  ...
}`;

    try{
      const suggestions = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_scene_completion',
          schema: completeSceneOutputSchema,
          maxTokens: 512,
          temperature: 0.7,
        }
      );
      return { suggestions: { ...existingElements, ...suggestions } };
    } catch (error) {
      logger.error('Failed to complete scene', { error });
      return { suggestions: existingElements };
    }
  }
}

