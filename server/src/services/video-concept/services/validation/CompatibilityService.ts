import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { AIService } from '@services/prompt-optimization/types';
import type { CacheService } from '@services/cache/CacheService';
import type { Suggestion } from '../generation/SuggestionGeneratorService';

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  score: number;
  feedback: string;
  conflicts?: string[];
  suggestions?: string[];
}

/**
 * Service responsible for checking semantic and thematic compatibility
 * between video elements.
 */
export class CompatibilityService {
  private readonly ai: AIService;
  private readonly cacheService: CacheService;
  private readonly semanticCache: Map<string, number> = new Map();
  private readonly log: ILogger;

  constructor(aiService: AIService, cacheService: CacheService) {
    this.ai = aiService;
    this.cacheService = cacheService;
    this.log = logger.child({ service: 'CompatibilityService' });
  }

  /**
   * Score semantic compatibility between suggestion and existing elements
   */
  async scoreSemanticCompatibility(
    suggestion: Suggestion,
    existingElements: Record<string, unknown>
  ): Promise<number> {
    const startTime = performance.now();
    const operation = 'scoreSemanticCompatibility';
    const cacheKey = `${suggestion.text}_${JSON.stringify(existingElements)}`;

    // Check cache first
    if (this.semanticCache.has(cacheKey)) {
      this.log.debug('Cache hit.', {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return this.semanticCache.get(cacheKey)!;
    }
    
    this.log.debug('Starting operation.', {
      operation,
      suggestionLength: suggestion.text.length,
      elementCount: Object.keys(existingElements).length,
    });

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

      const score = parseFloat((response.text || response.content?.[0]?.text || '').trim());

      // Cache the score
      const normalizedScore = isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
      this.semanticCache.set(cacheKey, normalizedScore);

      this.log.debug('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        score: normalizedScore,
      });

      return normalizedScore;
    } catch (error) {
      this.log.warn('Operation failed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        error: error instanceof Error ? error.message : String(error),
      });
      return 0.5; // Default neutral score on error
    }
  }

  /**
   * Filter suggestions by semantic compatibility threshold
   */
  async filterBySemanticCompatibility(
    suggestions: Suggestion[],
    params: {
      elementType: string;
      context: Record<string, string>;
      concept?: string;
    }
  ): Promise<Suggestion[]> {
    const startTime = performance.now();
    const operation = 'filterBySemanticCompatibility';
    
    this.log.debug('Starting operation.', {
      operation,
      suggestionCount: suggestions.length,
      elementType: params.elementType,
      hasContext: !!params.context,
    });

    // Build existing elements object
    const existingElements = {
      elementType: params.elementType,
      context: params.context || {},
      concept: params.concept || '',
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
      .filter(s => s.compatibilityScore! >= threshold)
      .sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));

    // Ensure we return at least 4 suggestions
    const result = filtered.length < 4
      ? scoredSuggestions
          .sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0))
          .slice(0, 8)
      : filtered;

    this.log.info('Operation completed.', {
      operation,
      duration: Math.round(performance.now() - startTime),
      inputCount: suggestions.length,
      outputCount: result.length,
      filtered: suggestions.length - filtered.length,
    });

    return result;
  }

  /**
   * Check compatibility between element value and existing elements
   */
  async checkCompatibility(params: {
    elementType: string;
    value: string;
    existingElements: Record<string, string>;
  }): Promise<CompatibilityResult> {
    const startTime = performance.now();
    const operation = 'checkCompatibility';
    
    this.log.debug('Starting operation.', {
      operation,
      elementType: params.elementType,
      valueLength: params.value.length,
      existingElementCount: Object.keys(params.existingElements).length,
    });

    if (!params.value || Object.keys(params.existingElements).length === 0) {
      this.log.debug('Operation skipped.', {
        operation,
        reason: 'no_value_or_elements',
        duration: Math.round(performance.now() - startTime),
      });
      return { score: 1, feedback: 'No conflicts detected' };
    }

    const prompt = `Analyze the compatibility of this element with existing elements.

New Element: ${params.elementType} = "${params.value}"

Existing Elements:
${Object.entries(params.existingElements)
  .filter(([k, v]) => v && k !== params.elementType)
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
      const schema: { type: 'object' | 'array'; required?: string[] } = {
        type: 'object' as const,
        required: ['score', 'feedback'],
      };
      
      const result = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        prompt,
        {
          operation: 'video_compatibility_check',
          schema,
          maxTokens: 256,
          temperature: 0.3,
        }
      ) as CompatibilityResult;
      
      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        score: result.score,
        hasConflicts: !!result.conflicts && result.conflicts.length > 0,
      });
      
      return result;
    } catch (error) {
      this.log.error('Operation failed.', error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        elementType: params.elementType,
      });
      return { score: 0.5, feedback: 'Unable to determine compatibility' };
    }
  }

  /**
   * Clear semantic cache
   */
  clearCache(): void {
    this.semanticCache.clear();
  }
}
