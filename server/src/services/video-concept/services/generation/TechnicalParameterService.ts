import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { AIService } from '@services/prompt-optimization/types';

/**
 * Service responsible for generating technical video production parameters.
 * Generates camera settings, lighting, color grading, format specifications,
 * audio recommendations, and post-production effects.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class TechnicalParameterService {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'TechnicalParameterService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    
    this.log.debug('TechnicalParameterService initialized', {
      operation: 'constructor',
    });
  }

  /**
   * Generate technical parameters based on creative elements
   */
  async generateTechnicalParams(params: {
    elements: Record<string, string>;
  }): Promise<{ technicalParams: Record<string, unknown> }> {
    const operation = 'generateTechnicalParams';
    const startTime = performance.now();
    
    const elementCount = Object.entries(params.elements).filter(([_, v]) => v).length;
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      elementCount,
    });

    const prompt = `Generate technical video parameters based on these creative elements.

Elements:
${Object.entries(params.elements)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Suggest appropriate:
1. Camera settings (angles, movement, lenses)
2. Lighting setup
3. Color grading
4. Frame rate and aspect ratio
5. Audio considerations
6. Post-production effects

Return ONLY a JSON object:
{
  "camera": {
    "angle": "...",
    "movement": "...",
    "lens": "..."
  },
  "lighting": {
    "type": "...",
    "direction": "...",
    "quality": "..."
  },
  "color": {
    "grading": "...",
    "palette": "..."
  },
  "format": {
    "frameRate": "...",
    "aspectRatio": "...",
    "resolution": "..."
  },
  "audio": {
    "style": "...",
    "mood": "..."
  },
  "postProduction": {
    "effects": ["..."],
    "transitions": "..."
  }
}`;

    try {
      const schema: { type: 'object' | 'array'; required?: string[] } = {
        type: 'object' as const,
        required: ['camera', 'lighting', 'color', 'format', 'audio', 'postProduction'],
      };
      
      const technicalParams = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_technical_params',
          schema,
          maxTokens: 768,
          temperature: 0.5,
        }
      ) as Record<string, unknown>;
      
      const duration = Math.round(performance.now() - startTime);
      this.log.info(`${operation} completed`, {
        operation,
        duration,
        elementCount,
        paramCount: Object.keys(technicalParams).length,
      });
      
      return { technicalParams };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration,
        elementCount,
      });
      return { technicalParams: {} };
    }
  }
}

