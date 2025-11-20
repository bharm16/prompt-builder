import { logger } from '../../../../infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '../../../../utils/StructuredOutputEnforcer.js';
import { compatibilityOutputSchema } from '../../../../utils/validation.js';

/**
 * Service responsible for checking semantic and thematic compatibility
 * between video elements.
 */
export class CompatibilityService {
  constructor(aiService, cacheService) {
    this.ai = aiService;
    this.cacheService = cacheService;
    this.semanticCache = new Map(); // In-memory cache for compatibility scores
  }

  /**
   * Score semantic compatibility between suggestion and existing elements
   */
  async scoreSemanticCompatibility(suggestion, existingElements) {
    const cacheKey = `${suggestion.text}_${JSON.stringify(existingElements)}`;

    // Check cache first
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey);
    }

    const compatibilityPrompt = `Analyze the semantic and thematic compatibility between this suggestion and the existing creative elements.

Suggestion: "${suggestion.text}"
Explanation: "${suggestion.explanation}"

Existing Elements:
${JSON.stringify(existingElements, null, 2)}

Consider:
1. Thematic coherence - Do these elements work together narratively?
2. Visual harmony - Would these create a cohesive visual scene?
3. Logical consistency - Do these make sense together?
4. Creative synergy - Do they enhance each other?

Respond with ONLY a decimal number between 0 and 1, where:
- 0.9-1.0: Perfect harmony, enhances the concept
- 0.7-0.89: Strong compatibility, works well together
- 0.5-0.69: Moderate compatibility, could work with adjustments
- 0.3-0.49: Weak compatibility, conflicts present
- 0-0.29: Poor compatibility, contradictory elements

Score:`;

    try {
      const response = await this.ai.execute('video_compatibility', {
        systemPrompt: compatibilityPrompt,
        maxTokens: 10,
        temperature: 0.1,
      });

      const score = parseFloat(response.content[0].text.trim());

      // Cache the score
      this.semanticCache.set(cacheKey, score);

      return isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch (error) {
      logger.warn('Failed to score semantic compatibility', { error });
      return 0.5; // Default neutral score on error
    }
  }

  /**
   * Filter suggestions by semantic compatibility threshold
   */
  async filterBySemanticCompatibility(suggestions, { elementType, context, concept }) {
    // Build existing elements object
    const existingElements = {
      elementType,
      context: context || {},
      concept: concept || '',
    };

    // Score all suggestions
    const scoredSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => ({
        ...suggestion,
        compatibilityScore: await this.scoreSemanticCompatibility(
          suggestion,
          existingElements
        ),
      }))
    );

    // Filter by threshold and sort by score
    const threshold = 0.6; // Minimum compatibility score
    const filtered = scoredSuggestions
      .filter(s => s.compatibilityScore >= threshold)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Ensure we return at least 4 suggestions
    if (filtered.length < 4) {
      return scoredSuggestions
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, 8);
    }

    return filtered;
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
      return await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_compatibility_check',
          schema: compatibilityOutputSchema,
          maxTokens: 256,
          temperature: 0.3,
        }
      );
    } catch (error) {
      logger.error('Failed to check compatibility', { error });
      return { score: 0.5, feedback: 'Unable to determine compatibility' };
    }
  }

  /**
   * Clear semantic cache
   */
  clearCache() {
    this.semanticCache.clear();
  }
}
