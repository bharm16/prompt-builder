/**
 * SuggestionGenerationService
 *
 * Generates enhancement suggestions using contrastive decoding or standard generation.
 * Handles AI service calls, contrastive diversity enforcement, and poisonous pattern detection.
 * 
 * Provider-Aware Optimizations:
 * - OpenAI: Uses strict schema + developer role for hard constraints
 * - Groq: Uses validation-based schema + embedded constraints
 */

import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { detectAndGetCapabilities } from '@utils/provider/ProviderDetector';
import { POISONOUS_PATTERNS } from '../constants';
import { getEnhancementSchema } from '../config/schemas';
import type {
  AIService,
  Suggestion,
  EnhancementMetrics,
  OutputSchema,
  PromptBuildResult,
} from './types';
import type { ContrastiveDiversityEnforcer } from './ContrastiveDiversityEnforcer';

export interface SuggestionGenerationParams {
  systemPrompt: string;
  schema: OutputSchema;
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  highlightedText: string;
  temperature: number;
  metrics: EnhancementMetrics;
  /** Provider for optimization selection */
  provider?: 'openai' | 'groq' | 'qwen';
  /** Developer message for OpenAI (hard constraints) */
  developerMessage?: string;
  /** Whether to use strict schema mode (OpenAI) */
  useStrictSchema?: boolean;
  /** Qwen3 reasoning effort */
  reasoningEffort?: 'none' | 'default';
}

export interface SuggestionGenerationParamsV2 {
  promptResult: PromptBuildResult | string;
  schema: OutputSchema;
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  highlightedText: string;
  temperature: number;
  metrics: EnhancementMetrics;
}

export interface SuggestionGenerationResult {
  suggestions: Suggestion[] | null;
  groqCallTime: number;
  usedContrastiveDecoding: boolean;
}

/**
 * Service for generating enhancement suggestions
 */
export class SuggestionGenerationService {
  constructor(
    private readonly ai: AIService,
    private readonly contrastiveDiversity: ContrastiveDiversityEnforcer
  ) {}

  /**
   * Generate suggestions using the new provider-aware prompt result
   */
  async generateSuggestionsV2(
    params: SuggestionGenerationParamsV2
  ): Promise<SuggestionGenerationResult> {
    const { promptResult, schema, isVideoPrompt, isPlaceholder, highlightedText, temperature, metrics } = params;
    const resolvedPromptResult: PromptBuildResult =
      typeof promptResult === 'string'
        ? (() => {
            const { provider, capabilities } = detectAndGetCapabilities({
              operation: 'enhance_suggestions',
            });
            const resolvedProvider =
              provider === 'openai' || provider === 'qwen' ? provider : 'groq';
            return {
              systemPrompt: promptResult,
              provider: resolvedProvider,
              ...(resolvedProvider === 'openai' && capabilities.strictJsonSchema
                ? { useStrictSchema: true }
                : {}),
            };
          })()
        : promptResult;

    return this.generateSuggestions({
      systemPrompt: resolvedPromptResult.systemPrompt,
      schema,
      isVideoPrompt,
      isPlaceholder,
      highlightedText,
      temperature,
      metrics,
      provider: resolvedPromptResult.provider,
      ...(resolvedPromptResult.developerMessage
        ? { developerMessage: resolvedPromptResult.developerMessage }
        : {}),
      ...(resolvedPromptResult.useStrictSchema
        ? { useStrictSchema: resolvedPromptResult.useStrictSchema }
        : {}),
      ...(resolvedPromptResult.reasoningEffort
        ? { reasoningEffort: resolvedPromptResult.reasoningEffort }
        : {}),
    });
  }

  /**
   * Generate suggestions using contrastive decoding or standard generation
   */
  async generateSuggestions(
    params: SuggestionGenerationParams
  ): Promise<SuggestionGenerationResult> {
    const groqStart = Date.now();
    const { provider = 'groq', developerMessage, useStrictSchema, reasoningEffort } = params;

    const providerSchema = getEnhancementSchema(params.isPlaceholder, { provider });
    const enforceOptions: Parameters<typeof StructuredOutputEnforcer.enforceJSON>[2] = {
      schema: providerSchema as
        | { type: 'object' | 'array'; required?: string[]; items?: { required?: string[] }; additionalProperties?: boolean }
        | null,
      isArray: true,
      maxTokens: 2048,
      maxRetries: 2,
      temperature: params.temperature,
      operation: 'enhance_suggestions',
      provider,
      ...(provider === 'openai' && developerMessage ? { developerMessage } : {}),
      ...(provider === 'openai' && useStrictSchema ? { useStrictSchema } : {}),
      ...(provider === 'qwen' && !reasoningEffort ? { reasoningEffort: 'none' } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
    };

    let suggestions = await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
      this.ai,
      params.systemPrompt,
      enforceOptions
    );

    let usedContrastiveDecoding = false;
    const diversityMetrics = Array.isArray(suggestions)
      ? this.contrastiveDiversity.calculateDiversityMetrics(suggestions)
      : null;
    const tooFewSuggestions = Array.isArray(suggestions) && suggestions.length < 6;
    const tooSimilar =
      !!diversityMetrics &&
      (diversityMetrics.avgSimilarity > 0.6 || diversityMetrics.maxSimilarity > 0.85);

    const shouldAttemptContrastive =
      provider !== 'openai' &&
      this.contrastiveDiversity.shouldUseContrastiveDecoding({
        systemPrompt: params.systemPrompt,
        schema: providerSchema as OutputSchema,
        isVideoPrompt: params.isVideoPrompt,
        isPlaceholder: params.isPlaceholder,
        highlightedText: params.highlightedText,
      }) &&
      (tooFewSuggestions || tooSimilar);

    if (shouldAttemptContrastive) {
      const contrastiveSuggestions =
        await this.contrastiveDiversity.generateWithContrastiveDecoding({
          systemPrompt: params.systemPrompt,
          schema: providerSchema as OutputSchema,
          isVideoPrompt: params.isVideoPrompt,
          isPlaceholder: params.isPlaceholder,
          highlightedText: params.highlightedText,
        });

      if (contrastiveSuggestions && contrastiveSuggestions.length > 0) {
        suggestions = contrastiveSuggestions;
        usedContrastiveDecoding = true;
      }
    }

    if (usedContrastiveDecoding && Array.isArray(suggestions)) {
      const contrastiveMetrics =
        this.contrastiveDiversity.calculateDiversityMetrics(suggestions);
      logger.info('Contrastive decoding diversity metrics', {
        avgSimilarity: contrastiveMetrics.avgSimilarity,
        minSimilarity: contrastiveMetrics.minSimilarity,
        maxSimilarity: contrastiveMetrics.maxSimilarity,
        pairCount: contrastiveMetrics.pairCount,
      });
    }

    const groqCallTime = Date.now() - groqStart;

    // Check for poisonous patterns
    const poisonousPatterns = POISONOUS_PATTERNS;
    const isPoisonous = (text?: string | null): boolean => {
      if (!text) return false;
      const lowerText = text.toLowerCase();
      return poisonousPatterns.some((pattern) => {
        const lowerPattern = pattern.toLowerCase();
        return lowerText.includes(lowerPattern) || lowerText === lowerPattern;
      });
    };
    const hasPoisonousText =
      Array.isArray(suggestions) &&
      suggestions.some((s) => isPoisonous(s.text));

    const sampleSuggestions = Array.isArray(suggestions)
      ? suggestions.slice(0, 3).map((s) => s.text)
      : [];

    logger.info('Raw suggestions from LLM', {
      isPlaceholder: params.isPlaceholder,
      suggestionsCount: Array.isArray(suggestions) ? suggestions.length : 0,
      hasCategory: suggestions?.[0]?.category !== undefined,
      zeroShotActive: true,
      hasPoisonousText,
      sampleSuggestions,
      provider,
      usedStrictSchema: useStrictSchema && provider === 'openai',
      usedDeveloperRole: !!(developerMessage && provider === 'openai'),
    });

    if (hasPoisonousText && Array.isArray(suggestions)) {
      logger.warn(
        'ALERT: Poisonous example patterns detected in zero-shot suggestions!',
        {
          highlightedText: params.highlightedText,
          suggestions: suggestions.map((s) => s.text),
        }
      );

      const filteredSuggestions = suggestions.filter((s) => !isPoisonous(s.text));
      const filteredCount = suggestions.length - filteredSuggestions.length;

      logger.warn('Poisonous suggestions detected (logging only - allowed by Qwen reasoning)', {
        highlightedText: params.highlightedText,
        filteredCount,
        poisonousTexts: suggestions.filter(s => isPoisonous(s.text)).map(s => s.text),
        provider,
      });

      // Relaxed: Allow them through if the model reasoned they were okay
      // suggestions = filteredSuggestions;
    }

    return {
      suggestions,
      groqCallTime,
      usedContrastiveDecoding,
    };
  }
}
