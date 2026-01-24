import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { PromptBuilderService } from './SystemPromptBuilder.ts';
import { TAXONOMY } from '#shared/taxonomy.ts';
import type { AIService } from '@services/prompt-optimization/types';
import type { PreferenceRepository } from '@services/video-concept/repositories/PreferenceRepository';
import type { CacheService } from '@services/cache/CacheService';
import type { ILogger } from '@interfaces/ILogger';

const SUBJECT_DESCRIPTOR_KEYS = ['subjectDescriptor1', 'subjectDescriptor2', 'subjectDescriptor3'] as const;

/**
 * Map legacy wizard field names to strict Taxonomy IDs
 * Ensures server-side suggestion generation uses correct taxonomy categories
 */
const FIELD_CATEGORY_MAP: Record<string, string> = {
  subject: TAXONOMY.SUBJECT.id,
  action: TAXONOMY.SUBJECT.attributes.ACTION,
  location: TAXONOMY.ENVIRONMENT.attributes.LOCATION,
  time: TAXONOMY.LIGHTING.attributes.TIME,
  mood: TAXONOMY.STYLE.attributes.AESTHETIC,
  style: TAXONOMY.STYLE.id,
  event: TAXONOMY.ENVIRONMENT.attributes.CONTEXT,
};

/**
 * Suggestion with explanation
 */
export interface Suggestion {
  text: string;
  explanation: string;
  preferenceScore?: number;
}

/**
 * Alternative phrasing
 */
export interface AlternativePhrasing {
  text: string;
  tone: string;
}

/**
 * Compatibility service interface
 */
interface CompatibilityService {
  filterBySemanticCompatibility(
    suggestions: Suggestion[],
    params: {
      elementType: string;
      context: Record<string, string>;
      concept?: string;
    }
  ): Promise<Suggestion[]>;
}

/**
 * Service responsible for generating creative suggestions for video elements.
 * Handles suggestion generation, filtering, and ranking.
 */
export class SuggestionGeneratorService {
  private readonly ai: AIService;
  private readonly cacheService: CacheService;
  private readonly preferenceRepository: PreferenceRepository;
  private readonly compatibilityService: CompatibilityService;
  private readonly promptBuilder: PromptBuilderService;
  private readonly cacheConfig: { ttl: number; namespace: string };
  private readonly log: ILogger;

  constructor(
    aiService: AIService,
    cacheService: CacheService,
    preferenceRepository: PreferenceRepository,
    compatibilityService: CompatibilityService
  ) {
    this.ai = aiService;
    this.cacheService = cacheService;
    this.preferenceRepository = preferenceRepository;
    this.compatibilityService = compatibilityService;
    this.promptBuilder = new PromptBuilderService();
    this.cacheConfig = cacheService.getConfig('creative');
    this.log = logger.child({ service: 'SuggestionGeneratorService' });
  }

  /**
   * Generate creative suggestions for a video element
   */
  async getCreativeSuggestions(params: {
    elementType: string;
    currentValue?: string;
    context?: Record<string, string>;
    concept?: string;
    userId?: string;
  }): Promise<{ suggestions: Suggestion[] }> {
    const startTime = performance.now();
    const operation = 'getCreativeSuggestions';
    
    const normalizedElementType = (SUBJECT_DESCRIPTOR_KEYS as readonly string[]).includes(params.elementType)
      ? 'subjectDescriptor'
      : params.elementType;

    // Resolve Taxonomy ID for scoping
    // If it's a descriptor, scope to the Subject Group generally
    const taxonomyScope = normalizedElementType === 'subjectDescriptor'
      ? TAXONOMY.SUBJECT.id 
      : FIELD_CATEGORY_MAP[params.elementType];

    this.log.debug('Starting operation.', {
      operation,
      elementType: params.elementType,
      normalizedElementType,
      taxonomyScope,
      hasContext: !!params.context,
      hasConcept: !!params.concept,
    });

    // Check cache
    const cacheKey = this.cacheService.generateKey(this.cacheConfig.namespace, {
      elementType: params.elementType,
      normalizedElementType,
      currentValue: params.currentValue,
      context: params.context,
      concept: params.concept?.substring(0, 200),
    });

    const cached = await this.cacheService.get<{ suggestions: Suggestion[] }>(cacheKey, 'creative-suggestions');
    if (cached) {
      this.log.debug('Cache hit.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        suggestionCount: cached.suggestions.length,
      });
      return cached;
    }

    // Build system prompt with taxonomy scope
    const systemPromptParams: {
      elementType: string;
      taxonomyScope?: string;
      currentValue?: string;
      context?: Record<string, string>;
      concept?: string;
    } = {
      elementType: normalizedElementType,
    };
    
    if (taxonomyScope !== undefined) {
      systemPromptParams.taxonomyScope = taxonomyScope;
    }
    if (params.currentValue !== undefined) {
      systemPromptParams.currentValue = params.currentValue;
    }
    if (params.context !== undefined) {
      systemPromptParams.context = params.context;
    }
    if (params.concept !== undefined) {
      systemPromptParams.concept = params.concept;
    }
    
    const systemPrompt = this.promptBuilder.buildSystemPrompt(systemPromptParams);

    // Define schema for validation
    const schema: { type: 'object' | 'array'; items?: { required?: string[] } } = {
      type: 'array' as const,
      items: {
        required: ['text', 'explanation'],
      },
    };

    // Get optimal temperature for creative suggestions
    const temperature = TemperatureOptimizer.getOptimalTemperature('creative-suggestion', {
      diversity: 'high',
      precision: 'low',
    });

    // Call AI service with structured output enforcement
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.ai,
      systemPrompt,
      {
        operation: 'video_suggestions',
        schema,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    ) as Suggestion[];

    // Apply semantic compatibility filtering if context exists
    let filteredSuggestions = suggestions;
    if (params.context && Object.keys(params.context).length > 0) {
      const filterParams: { elementType: string; context: Record<string, string>; concept?: string } = {
        elementType: normalizedElementType,
        context: params.context,
      };
      if (params.concept !== undefined) {
        filterParams.concept = params.concept;
      }
      filteredSuggestions = await this.compatibilityService.filterBySemanticCompatibility(
        suggestions,
        filterParams
      );
    }

    // Apply user preference ranking
    const rankedSuggestions = await this.rankByUserPreferences(
      filteredSuggestions,
      normalizedElementType,
      params.userId || 'default'
    );

    const result = { suggestions: rankedSuggestions };

    // Cache the result
    await this.cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    this.log.info('Operation completed.', {
      operation,
      duration: Math.round(performance.now() - startTime),
      elementType: normalizedElementType,
      count: rankedSuggestions.length,
      filtered: suggestions.length - filteredSuggestions.length,
    });

    return result;
  }

  /**
   * Rank suggestions based on user preferences
   */
  private async rankByUserPreferences(
    suggestions: Suggestion[],
    elementType: string,
    userId: string = 'default'
  ): Promise<Suggestion[]> {
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
      const scoreDiff = (b.preferenceScore || 0) - (a.preferenceScore || 0);
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      return 0; // Maintain original order for similar scores
    });
  }

  /**
   * Calculate preference score based on historical choices
   */
  private calculatePreferenceScore(suggestion: Suggestion, preferences: { chosen: string[]; rejected: string[] }): number {
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
   */
  private getCommonKeywords(text1: string, text2: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words1 = text1.split(/\s+/).filter(w => !stopWords.has(w));
    const words2 = text2.split(/\s+/).filter(w => !stopWords.has(w));
    return words1.filter(w => words2.includes(w));
  }

  /**
   * Get alternative phrasings for an element
   */
  async getAlternativePhrasings(params: {
    elementType: string;
    value: string;
  }): Promise<{ alternatives: AlternativePhrasing[] }> {
    const startTime = performance.now();
    const operation = 'getAlternativePhrasings';
    
    this.log.debug('Starting operation.', {
      operation,
      elementType: params.elementType,
      valueLength: params.value.length,
    });

    const prompt = `Provide 5 alternative ways to phrase this ${params.elementType}.

Original: "${params.value}"

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
      const schema: { type: 'object' | 'array'; items?: { required?: string[] } } = {
        type: 'array' as const,
        items: {
          required: ['text', 'tone'],
        },
      };

      const alternatives = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_alternatives',
          schema,
          isArray: true,
          maxTokens: 512,
          temperature: 0.7,
        }
      ) as AlternativePhrasing[];
      
      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        alternativeCount: alternatives.length,
      });
      
      return { alternatives };
    } catch (error) {
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        elementType: params.elementType,
      });
      return { alternatives: [] };
    }
  }
}
