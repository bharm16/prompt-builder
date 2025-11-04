import { logger } from '../../infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '../../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../../utils/TemperatureOptimizer.js';
import { PromptBuilderService } from './PromptBuilderService.js';

const SUBJECT_DESCRIPTOR_KEYS = ['subjectDescriptor1', 'subjectDescriptor2', 'subjectDescriptor3'];

/**
 * Service responsible for generating creative suggestions for video elements.
 * Handles suggestion generation, filtering, and ranking.
 */
export class SuggestionGeneratorService {
  constructor(claudeClient, cacheService, preferenceRepository, compatibilityService) {
    this.claudeClient = claudeClient;
    this.cacheService = cacheService;
    this.preferenceRepository = preferenceRepository;
    this.compatibilityService = compatibilityService;
    this.promptBuilder = new PromptBuilderService();
    this.cacheConfig = cacheService.getConfig('creative');
  }

  /**
   * Generate creative suggestions for a video element
   * @param {Object} params - Suggestion parameters
   * @returns {Promise<Object>} Creative suggestions
   */
  async getCreativeSuggestions({
    elementType,
    currentValue,
    context,
    concept,
    userId = 'default',
  }) {
    const normalizedElementType = SUBJECT_DESCRIPTOR_KEYS.includes(elementType)
      ? 'subjectDescriptor'
      : elementType;

    logger.info('Generating creative suggestions', { elementType, normalizedElementType });

    // Check cache
    const cacheKey = this.cacheService.generateKey(this.cacheConfig.namespace, {
      elementType,
      normalizedElementType,
      currentValue,
      context,
      concept: concept?.substring(0, 200),
    });

    const cached = await this.cacheService.get(cacheKey, 'creative-suggestions');
    if (cached) {
      logger.debug('Cache hit for creative suggestions');
      return cached;
    }

    // Build system prompt
    const systemPrompt = this.promptBuilder.buildSystemPrompt({
      elementType: normalizedElementType,
      currentValue,
      context,
      concept,
    });

    // Define schema for validation
    const schema = {
      type: 'array',
      items: {
        required: ['text', 'explanation'],
      },
    };

    // Get optimal temperature for creative suggestions
    const temperature = TemperatureOptimizer.getOptimalTemperature('creative-suggestion', {
      diversity: 'high',
      precision: 'low',
    });

    // Call Claude API with structured output enforcement
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Apply semantic compatibility filtering if context exists
    let filteredSuggestions = suggestions;
    if (context && Object.keys(context).length > 0) {
      filteredSuggestions = await this.compatibilityService.filterBySemanticCompatibility(
        suggestions,
        { elementType: normalizedElementType, context, concept }
      );
    }

    // Apply user preference ranking
    const rankedSuggestions = await this.rankByUserPreferences(
      filteredSuggestions,
      normalizedElementType,
      userId
    );

    const result = { suggestions: rankedSuggestions };

    // Cache the result
    await this.cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Creative suggestions generated', {
      elementType: normalizedElementType,
      count: rankedSuggestions.length,
      filtered: suggestions.length - filteredSuggestions.length,
    });

    return result;
  }

  /**
   * Rank suggestions based on user preferences
   * @private
   */
  async rankByUserPreferences(suggestions, elementType, userId = 'default') {
    const preferences = await this.preferenceRepository.getPreferences(userId, elementType);

    if (!preferences || preferences.chosen.length === 0) {
      return suggestions; // No preferences yet, return as-is
    }

    // Calculate preference scores
    const scoredSuggestions = suggestions.map(suggestion => ({
      ...suggestion,
      preferenceScore: this.calculatePreferenceScore(suggestion, preferences),
    }));

    // Sort by preference score, then by original order
    return scoredSuggestions.sort((a, b) => {
      const scoreDiff = b.preferenceScore - a.preferenceScore;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      return 0; // Maintain original order for similar scores
    });
  }

  /**
   * Calculate preference score based on historical choices
   * @private
   */
  calculatePreferenceScore(suggestion, preferences) {
    let score = 0;
    const text = suggestion.text.toLowerCase();

    // Positive signals from chosen items
    preferences.chosen.forEach(choice => {
      const choiceText = choice.toLowerCase();
      // Exact match
      if (text === choiceText) score += 2;
      // Partial match
      else if (text.includes(choiceText) || choiceText.includes(text)) score += 1;
      // Similar keywords
      const commonWords = this.getCommonKeywords(text, choiceText);
      score += commonWords.length * 0.5;
    });

    // Negative signals from rejected items
    preferences.rejected.forEach(rejected => {
      const rejectedText = rejected.toLowerCase();
      if (text === rejectedText) score -= 2;
      else if (text.includes(rejectedText) || rejectedText.includes(text)) score -= 1;
    });

    return Math.max(0, score);
  }

  /**
   * Get common keywords between two texts
   * @private
   */
  getCommonKeywords(text1, text2) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words1 = text1.split(/\s+/).filter(w => !stopWords.has(w));
    const words2 = text2.split(/\s+/).filter(w => !stopWords.has(w));
    return words1.filter(w => words2.includes(w));
  }

  /**
   * Get alternative phrasings for an element
   */
  async getAlternativePhrasings({ elementType, value }) {
    logger.info('Getting alternative phrasings', { elementType, value });

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
      const schema = {
        type: 'array',
        items: {
          required: ['text', 'tone'],
        },
      };

      const alternatives = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema,
          isArray: true,
          maxTokens: 512,
          temperature: 0.7,
        }
      );
      return { alternatives };
    } catch (error) {
      logger.error('Failed to get alternatives', { error });
      return { alternatives: [] };
    }
  }
}
