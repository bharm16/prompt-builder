import { logger } from '@infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { variationsOutputSchema } from '@utils/validation.js';

/**
 * Service responsible for generating creative variations of video scenes.
 * Creates alternative versions exploring different approaches while maintaining theme.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class SceneVariationService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Generate variations of current element setup
   * @param {Object} params - Variation parameters
   * @param {Object} params.elements - Current elements
   * @param {string} params.concept - Overall concept
   * @returns {Promise<Object>} Array of variations
   */
  async generateVariations({ elements, concept }) {
    logger.info('Generating scene variations');

    const prompt = `Generate 3 creative variations of this video concept.

Original Concept: ${concept || 'Not specified'}

Original Elements:
${Object.entries(elements)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Create 3 variations that:
1. Maintain the core theme but explore different approaches
2. Vary in mood, style, or perspective
3. Each offers a unique creative direction

Return ONLY a JSON array of 3 variations:
[
  {
    "name": "Variation Name",
    "description": "What makes this different",
    "elements": {
      "subject": "...",
      "action": "...",
      // ... all elements
    },
    "changes": ["key changes from original"]
  },
  // ... 2 more variations
]`;

    try {
      const variations = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_scene_variations',
          schema: variationsOutputSchema,
          isArray: true,
          maxTokens: 2048,
          temperature: 0.8,
        }
      );
      return { variations };
    } catch (error) {
      logger.error('Failed to generate variations', { error });
      return { variations: [] };
    }
  }
}

