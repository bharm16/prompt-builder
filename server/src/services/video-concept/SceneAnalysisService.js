import { logger } from '../../infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '../../utils/StructuredOutputEnforcer.js';
import {
  completeSceneOutputSchema,
  variationsOutputSchema,
  parseConceptOutputSchema,
  refinementsOutputSchema,
  technicalParamsOutputSchema,
  validatePromptOutputSchema,
  smartDefaultsOutputSchema,
} from '../../utils/validation.js';

/**
 * Service responsible for scene analysis tasks:
 * - Scene completion (filling empty elements)
 * - Variation generation
 * - Concept parsing
 * - Refinement suggestions
 * - Technical parameter generation
 * - Prompt validation
 * - Smart defaults
 */
export class SceneAnalysisService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
  }

  /**
   * Complete scene by suggesting all empty elements
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

    try {
      const suggestions = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
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

  /**
   * Generate variations of current element setup
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
        this.claudeClient,
        prompt,
        {
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

  /**
   * Parse a concept description into individual elements
   */
  async parseConcept({ concept }) {
    logger.info('Parsing concept into elements');

    const prompt = `Break down this video concept into structured elements.

Concept: "${concept}"

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
      const elements = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: parseConceptOutputSchema,
          maxTokens: 512,
          temperature: 0.5,
        }
      );
      return { elements };
    } catch (error) {
      logger.error('Failed to parse concept', { error });
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

  /**
   * Get refined suggestions based on progressive context
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

  /**
   * Generate technical parameters based on elements
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
        this.claudeClient,
        prompt,
        {
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

  /**
   * Validate prompt quality and completeness
   */
  async validatePrompt({ elements, concept }) {
    logger.info('Validating prompt quality');

    const prompt = `Evaluate the quality and completeness of this video prompt.

Concept: ${concept || 'Not specified'}

Elements:
${Object.entries(elements)
  .map(([k, v]) => `${k}: ${v || '(empty)'}`)
  .join('\n')}

Evaluate:
1. Completeness (0-30 points): How many elements are filled?
2. Specificity (0-25 points): How detailed and specific are the elements?
3. Coherence (0-25 points): How well do elements work together?
4. Visual Potential (0-20 points): How visually compelling is this concept?

Return ONLY a JSON object:
{
  "score": total score 0-100,
  "breakdown": {
    "completeness": 0-30,
    "specificity": 0-25,
    "coherence": 0-25,
    "visualPotential": 0-20
  },
  "feedback": ["specific improvement suggestions"],
  "strengths": ["what works well"],
  "weaknesses": ["what needs work"]
}`;

    try {
      const validation = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: validatePromptOutputSchema,
          maxTokens: 512,
          temperature: 0.3,
        }
      );
      return validation;
    } catch (error) {
      logger.error('Failed to validate prompt', { error });
      return {
        score: 50,
        breakdown: {},
        feedback: ['Unable to validate'],
        strengths: [],
        weaknesses: [],
      };
    }
  }

  /**
   * Get smart defaults for dependent elements
   */
  async getSmartDefaults({ elementType, existingElements }) {
    logger.info('Getting smart defaults', { elementType });

    const dependencies = Object.entries(existingElements)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    if (!dependencies) {
      return { defaults: [] };
    }

    const prompt = `Suggest smart default values for ${elementType} based on existing elements.

Existing Elements:
${dependencies}

Suggest 3 logical default values for ${elementType} that:
1. Naturally complement the existing elements
2. Maintain consistency
3. Enhance the overall concept

Return ONLY a JSON array:
["default 1", "default 2", "default 3"]`;

    try {
      const defaults = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: smartDefaultsOutputSchema,
          isArray: true,
          maxTokens: 256,
          temperature: 0.6,
        }
      );
      return { defaults };
    } catch (error) {
      logger.error('Failed to get smart defaults', { error });
      return { defaults: [] };
    }
  }
}
