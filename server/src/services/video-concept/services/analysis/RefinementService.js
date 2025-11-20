import { logger } from '../../../../infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '../../../../utils/StructuredOutputEnforcer.js';
import { refinementsOutputSchema } from '../../../../utils/validation.js';

/**
 * Service responsible for refining video scene elements for better coherence.
 * Suggests improved versions of existing elements that better align with each other.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class RefinementService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Get refined suggestions based on progressive context
   * @param {Object} params - Refinement parameters
   * @param {Object} params.elements - Current elements
   * @returns {Promise<Object>} Refinement suggestions for each element
   */
  async getRefinementSuggestions({ elements }) {
    logger.info('Getting refinement suggestions');

    const filledElements = Object.entries(elements).filter(([_, v]) => v);

    if (filledElements.length < 2) {
      return { refinements: {} };
    }

    const prompt = `Suggest refinements for these video elements to improve coherence.

Current Elements:
${filledElements.map(([k, v]) => `${k}: ${v}`).join('\n')}

For each element, suggest 2-3 refined versions that:
1. Better align with the other elements
2. Add more specificity
3. Enhance the overall creative vision

Return ONLY a JSON object:
{
  "${filledElements[0][0]}": ["refinement 1", "refinement 2"],
  ...
}`;

    try {
      const refinements = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: refinementsOutputSchema,
          maxTokens: 512,
          temperature: 0.6,
        }
      );
      return { refinements };
    } catch (error) {
      logger.error('Failed to get refinements', { error });
      return { refinements: {} };
    }
  }
}

