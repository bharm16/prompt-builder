import { logger } from '@infrastructure/Logger.ts';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { technicalParamsOutputSchema } from '@utils/validation.js';

/**
 * Service responsible for generating technical video production parameters.
 * Generates camera settings, lighting, color grading, format specifications,
 * audio recommendations, and post-production effects.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class TechnicalParameterService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Generate technical parameters based on creative elements
   * @param {Object} params - Generation parameters
   * @param {Object} params.elements - Scene elements
   * @returns {Promise<Object>} Technical parameters
   */
  async generateTechnicalParams({ elements }) {
    logger.info('Generating technical parameters');

    const prompt = `Generate technical video parameters based on these creative elements.

Elements:
${Object.entries(elements)
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
      const params = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_technical_params',
          schema: technicalParamsOutputSchema,
          maxTokens: 768,
          temperature: 0.5,
        }
      );
      return { technicalParams: params };
    } catch (error) {
      logger.error('Failed to generate technical params', { error });
      return { technicalParams: {} };
    }
  }
}

