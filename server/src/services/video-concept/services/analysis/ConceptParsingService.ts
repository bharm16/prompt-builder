import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { AIService } from '@services/prompt-optimization/types';

/**
 * Service responsible for parsing text concept descriptions into structured elements.
 * Extracts and infers video elements from natural language descriptions.
 * 
 * Extracted from SceneAnalysisService to follow single responsibility principle.
 */
export class ConceptParsingService {
  private readonly ai: AIService;
  private readonly log: ILogger;

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.log = logger.child({ service: 'ConceptParsingService' });
  }

  /**
   * Parse a concept description into individual elements
   */
  async parseConcept(params: { concept: string }): Promise<{ elements: Record<string, string> }> {
    const startTime = performance.now();
    const operation = 'parseConcept';
    
    this.log.debug('Starting operation.', {
      operation,
      conceptLength: params.concept.length,
    });

    const prompt = `Break down this video concept into structured elements.

Concept: "${params.concept}"

Extract and infer the following elements from the description:
- subject: The main focus (person, object, animal, etc.)
- action: What's happening (movement, activity, transformation)
- location: Where it takes place (setting, environment)
- time: When/time period (time of day, era, season)
- mood: The emotional atmosphere
- style: Visual treatment (cinematic, documentary, etc.)
- event: The context or occasion

If an element is not explicitly mentioned, make a reasonable inference based on the concept.

Return ONLY a JSON object with ALL elements:
{
  "subject": "specific subject",
  "action": "specific action",
  "location": "specific location",
  "time": "specific time",
  "mood": "specific mood",
  "style": "specific style",
  "event": "specific event"
}`;

    try {
      const schema: { type: 'object' | 'array'; required?: string[] } = {
        type: 'object' as const,
        required: ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'],
      };
      
      const elements = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_concept_parsing',
          schema,
          maxTokens: 512,
          temperature: 0.5,
        }
      ) as Record<string, string>;
      
      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        elementCount: Object.keys(elements).length,
      });
      
      return { elements };
    } catch (error) {
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return {
        elements: {
          subject: '',
          action: '',
          location: '',
          time: '',
          mood: '',
          style: '',
          event: '',
        },
      };
    }
  }
}
