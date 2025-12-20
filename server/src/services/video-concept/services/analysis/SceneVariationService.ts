import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { variationsOutputSchema } from '@utils/validation';
import type { AIService } from '@services/prompt-optimization/types';

/**
 * Scene variation result
 */
export interface SceneVariation {
  name: string;
  description: string;
  elements: Record<string, string>;
  changes: string[];
}

/**
 * Service responsible for generating creative variations of video scenes.
 * Creates alternative versions exploring different approaches while maintaining theme.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class SceneVariationService {
  private readonly ai: AIService;

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  /**
   * Generate variations of current element setup
   */
  async generateVariations(params: {
    elements: Record<string, string>;
    concept: string;
  }): Promise<{ variations: SceneVariation[] }> {
    logger.info('Generating scene variations');

    const prompt = `Generate 3 creative variations of this video concept.

Original Concept: ${params.concept || 'Not specified'}

Original Elements:
${Object.entries(params.elements)
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
      ) as SceneVariation[];
      return { variations };
    } catch (error) {
      logger.error('Failed to generate variations', error as Error);
      return { variations: [] };
    }
  }
}

