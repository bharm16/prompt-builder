import { logger } from '@infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { completeSceneOutputSchema } from '@utils/validation.js';
import type { AIService } from '../../prompt-optimization/types.js';

/**
 * Service responsible for completing video scenes by filling empty elements.
 * Suggests values for missing elements based on existing context.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class SceneCompletionService {
  private readonly ai: AIService;

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  /**
   * Complete scene by suggesting all empty elements
   */
  async completeScene(params: {
    existingElements: Record<string, string>;
    concept: string;
  }): Promise<{ suggestions: Record<string, string> }> {
    logger.info('Completing scene with AI suggestions');

    const emptyElements = Object.entries(params.existingElements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyElements.length === 0) {
      return { suggestions: params.existingElements };
    }

    const prompt = `Complete this video scene by filling in the missing elements.

Concept: ${params.concept || 'Not specified'}

Existing Elements:
${Object.entries(params.existingElements)
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

    try {
      const suggestions = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_scene_completion',
          schema: completeSceneOutputSchema,
          maxTokens: 512,
          temperature: 0.7,
        }
      ) as Record<string, string>;
      return { suggestions: { ...params.existingElements, ...suggestions } };
    } catch (error) {
      logger.error('Failed to complete scene', { error });
      return { suggestions: params.existingElements };
    }
  }
}

