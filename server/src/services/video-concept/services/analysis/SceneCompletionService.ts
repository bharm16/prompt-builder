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
  private readonly log = logger.child({ service: 'SceneCompletionService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    
    this.log.debug('SceneCompletionService initialized', {
      operation: 'constructor',
    });
  }

  /**
   * Complete scene by suggesting all empty elements
   */
  async completeScene(params: {
    existingElements: Record<string, string>;
    concept: string;
  }): Promise<{ suggestions: Record<string, string> }> {
    const operation = 'completeScene';
    const startTime = performance.now();
    
    const emptyElements = Object.entries(params.existingElements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    const filledCount = Object.keys(params.existingElements).length - emptyElements.length;
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      emptyElementCount: emptyElements.length,
      filledElementCount: filledCount,
      hasConcept: !!params.concept,
    });

    if (emptyElements.length === 0) {
      this.log.debug(`${operation}: No empty elements to complete`, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
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
      
      const duration = Math.round(performance.now() - startTime);
      const completedCount = Object.keys(suggestions).length;
      
      this.log.info(`${operation} completed`, {
        operation,
        duration,
        emptyElementCount: emptyElements.length,
        completedCount,
      });
      
      return { suggestions: { ...params.existingElements, ...suggestions } };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration,
        emptyElementCount: emptyElements.length,
      });
      return { suggestions: params.existingElements };
    }
  }
}

