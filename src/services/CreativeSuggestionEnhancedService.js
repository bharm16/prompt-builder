import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';

/**
 * Enhanced Creative Suggestion Service with advanced features
 */
export class CreativeSuggestionEnhancedService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('creative');
    this.userPreferences = new Map();
    this.semanticCache = new Map();
    this.templateUsage = new Map();
  }

  /**
   * Check compatibility between element value and existing elements
   */
  async checkCompatibility({ elementType, value, existingElements }) {
    logger.info('Checking element compatibility', { elementType });

    if (!value || Object.keys(existingElements).length === 0) {
      return { score: 1, feedback: 'No conflicts detected' };
    }

    const prompt = `Analyze the compatibility of this element with existing elements.

New Element: ${elementType} = "${value}"

Existing Elements:
${Object.entries(existingElements)
  .filter(([k, v]) => v && k !== elementType)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Consider:
1. Logical consistency (do these make sense together?)
2. Visual harmony (would these create a cohesive scene?)
3. Thematic coherence (do they support the same narrative?)
4. Physical possibility (are there impossible combinations?)

Respond with ONLY a JSON object:
{
  "score": 0.0-1.0 (compatibility score),
  "feedback": "brief explanation",
  "conflicts": ["any specific conflicts"],
  "suggestions": ["how to improve compatibility"]
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 256,
        temperature: 0.3,
      });

      return JSON.parse(response.content[0].text);
    } catch (error) {
      logger.error('Failed to check compatibility', { error });
      return { score: 0.5, feedback: 'Unable to determine compatibility' };
    }
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.7,
      });

      const suggestions = JSON.parse(response.content[0].text);
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 2048,
        temperature: 0.8,
      });

      const variations = JSON.parse(response.content[0].text);
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.5,
      });

      const elements = JSON.parse(response.content[0].text);
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.6,
      });

      const refinements = JSON.parse(response.content[0].text);
      return { refinements };
    } catch (error) {
      logger.error('Failed to get refinements', { error });
      return { refinements: {} };
    }
  }

  /**
   * Detect conflicts between elements
   */
  async detectConflicts({ elements }) {
    logger.info('Detecting element conflicts');

    const filledElements = Object.entries(elements).filter(([_, v]) => v);

    if (filledElements.length < 2) {
      return { conflicts: [] };
    }

    const prompt = `Analyze these video elements for logical conflicts or inconsistencies.

Elements:
${filledElements.map(([k, v]) => `${k}: ${v}`).join('\n')}

Identify any:
1. Logical impossibilities (e.g., underwater + flying)
2. Stylistic clashes (e.g., vintage style + futuristic setting)
3. Thematic inconsistencies
4. Physical contradictions

Return ONLY a JSON array of conflicts (empty array if none):
[
  {
    "elements": ["element1", "element2"],
    "severity": "high|medium|low",
    "message": "Description of conflict",
    "resolution": "Suggested fix"
  }
]`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.3,
      });

      const conflicts = JSON.parse(response.content[0].text);
      return { conflicts };
    } catch (error) {
      logger.error('Failed to detect conflicts', { error });
      return { conflicts: [] };
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 768,
        temperature: 0.5,
      });

      const params = JSON.parse(response.content[0].text);
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.3,
      });

      const validation = JSON.parse(response.content[0].text);
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
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 256,
        temperature: 0.6,
      });

      const defaults = JSON.parse(response.content[0].text);
      return { defaults };
    } catch (error) {
      logger.error('Failed to get smart defaults', { error });
      return { defaults: [] };
    }
  }

  /**
   * Save template for reuse
   */
  async saveTemplate({ name, elements, concept, userId }) {
    logger.info('Saving template', { name });

    // In a real implementation, this would save to a database
    const template = {
      id: Date.now().toString(),
      name,
      elements,
      concept,
      userId,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    // Track template usage for recommendations
    this.templateUsage.set(template.id, template);

    return { template, success: true };
  }

  /**
   * Get template recommendations based on usage
   */
  async getTemplateRecommendations({ userId, currentElements }) {
    logger.info('Getting template recommendations');

    // In a real implementation, this would query a database
    const templates = Array.from(this.templateUsage.values())
      .filter(t => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return { recommendations: templates };
  }

  /**
   * Learn from user choices
   */
  async recordUserChoice({ elementType, chosen, rejected, userId }) {
    logger.info('Recording user choice', { elementType, chosen });

    if (!this.userPreferences.has(userId)) {
      this.userPreferences.set(userId, new Map());
    }

    const userPrefs = this.userPreferences.get(userId);
    if (!userPrefs.has(elementType)) {
      userPrefs.set(elementType, { chosen: [], rejected: [] });
    }

    const prefs = userPrefs.get(elementType);
    prefs.chosen.push(chosen);
    prefs.rejected.push(...rejected);

    // Limit history
    if (prefs.chosen.length > 20) prefs.chosen.shift();
    if (prefs.rejected.length > 50) {
      prefs.rejected = prefs.rejected.slice(-50);
    }

    return { success: true };
  }

  /**
   * Get alternative phrasings for an element
   */
  async getAlternativePhrasings({ elementType, value }) {
    logger.info('Getting alternative phrasings', { elementType });

    const prompt = `Provide 5 alternative ways to phrase this ${elementType}.

Original: "${value}"

Generate alternatives that:
1. Maintain the same core meaning
2. Vary in tone (some more/less formal)
3. Vary in specificity (some more/less detailed)
4. Offer different stylistic approaches

Return ONLY a JSON array:
[
  {"text": "alternative 1", "tone": "formal|casual|poetic|technical"},
  {"text": "alternative 2", "tone": "..."},
  // ... 3 more
]`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.7,
      });

      const alternatives = JSON.parse(response.content[0].text);
      return { alternatives };
    } catch (error) {
      logger.error('Failed to get alternatives', { error });
      return { alternatives: [] };
    }
  }
}
