import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { AIService } from '@services/prompt-optimization/types';

/**
 * Service responsible for refining video scene elements for better coherence.
 * Suggests improved versions of existing elements that better align with each other.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class RefinementService {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'RefinementService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    
    this.log.debug('RefinementService initialized', {
      operation: 'constructor',
    });
  }

  /**
   * Get refined suggestions based on progressive context
   */
  async getRefinementSuggestions(params: {
    elements: Record<string, string>;
  }): Promise<{ refinements: Record<string, string[]> }> {
    const operation = 'getRefinementSuggestions';
    const startTime = performance.now();
    
    const filledElements = Object.entries(params.elements).filter(([_, v]) => v);

    this.log.debug(`Starting ${operation}`, {
      operation,
      filledElementCount: filledElements.length,
      totalElements: Object.keys(params.elements).length,
    });

    if (filledElements.length < 2) {
      this.log.debug(`${operation}: Insufficient elements for refinement`, {
        operation,
        filledElementCount: filledElements.length,
        duration: Math.round(performance.now() - startTime),
      });
      return { refinements: {} };
    }
    
    // Safe to access since we checked length >= 2
    const firstElementKey = filledElements[0]![0];

    const prompt = `Suggest refinements for these video elements to improve coherence.

Current Elements:
${filledElements.map(([k, v]) => `${k}: ${v}`).join('\n')}

For each element, suggest 2-3 refined versions that:
1. Better align with the other elements
2. Add more specificity
3. Enhance the overall creative vision

Return ONLY a JSON object:
{
  "${firstElementKey}": ["refinement 1", "refinement 2"],
  ...
}`;

    try {
      const schema: { type: 'object' | 'array' } = {
        type: 'object' as const,
      };
      
      const refinements = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_refinements',
          schema,
          maxTokens: 512,
          temperature: 0.6,
        }
      ) as Record<string, string[]>;
      
      const duration = Math.round(performance.now() - startTime);
      const refinementCount = Object.values(refinements).reduce((sum, arr) => sum + arr.length, 0);
      
      this.log.info(`${operation} completed`, {
        operation,
        duration,
        elementCount: Object.keys(refinements).length,
        refinementCount,
      });
      
      return { refinements };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration,
        filledElementCount: filledElements.length,
      });
      return { refinements: {} };
    }
  }
}

