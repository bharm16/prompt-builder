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

import { logger } from '@infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { POISONOUS_PATTERNS } from '../constants.js';
import { getEnhancementSchema } from '../config/schemas.js';
import type {
  AIService,
  Suggestion,
  EnhancementMetrics,
} from './types.js';
import type { ContrastiveDiversityEnforcer } from './ContrastiveDiversityEnforcer.js';
import type { PromptBuildResult } from './prompt-builders/index.js';

export interface SuggestionGenerationParams {
  systemPrompt: string;
  schema: Record<string, unknown>;
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  highlightedText: string;
  temperature: number;
  metrics: EnhancementMetrics;
  /** Provider for optimization selection */
  provider?: 'openai' | 'groq';
  /** Developer message for OpenAI (hard constraints) */
  developerMessage?: string;
  /** Whether to use strict schema mode (OpenAI) */
  useStrictSchema?: boolean;
}

export interface SuggestionGenerationParamsV2 {
  promptResult: PromptBuildResult;
  schema: Record<string, unknown>;
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

    return this.generateSuggestions({
      systemPrompt: promptResult.systemPrompt,
      schema,
      isVideoPrompt,
      isPlaceholder,
      highlightedText,
      temperature,
      metrics,
      provider: promptResult.provider,
      developerMessage: promptResult.developerMessage,
      useStrictSchema: promptResult.useStrictSchema,
    });
  }

  /**
   * Generate suggestions using contrastive decoding or standard generation
   */
  async generateSuggestions(
    params: SuggestionGenerationParams
  ): Promise<SuggestionGenerationResult> {
    const groqStart = Date.now();
    const { provider = 'groq', developerMessage, useStrictSchema } = params;

    // PDF Enhancement: Try contrastive decoding for enhanced diversity
    let suggestions: Suggestion[] | null =
      await this.contrastiveDiversity.generateWithContrastiveDecoding({
        systemPrompt: params.systemPrompt,
        schema: params.schema,
        isVideoPrompt: params.isVideoPrompt,
        isPlaceholder: params.isPlaceholder,
        highlightedText: params.highlightedText,
      });

    let usedContrastiveDecoding = false;

    // Fallback to standard generation if contrastive decoding not used/failed
    if (!suggestions) {
      // Create adapter for StructuredOutputEnforcer compatibility
      const aiAdapter = {
        execute: async (operation: string, options: Record<string, unknown>) => {
          // Build execute options
          const executeOptions: Record<string, unknown> = {
            systemPrompt: options.systemPrompt as string,
            ...options,
          };

          // Add OpenAI-specific options
          if (provider === 'openai') {
            if (developerMessage) {
              executeOptions.developerMessage = developerMessage;
            }
            // Use the strict schema
            if (useStrictSchema && options.schema) {
              executeOptions.schema = options.schema;
            }
          }

          const response = await this.ai.execute(operation, executeOptions as Parameters<AIService['execute']>[1]);
          // Convert AIResponse to AIServiceResponse format
          return {
            text: response.text,
            content: [{ text: response.text }],
          };
        },
      };

      // Get provider-specific schema
      const providerSchema = getEnhancementSchema(params.isPlaceholder, provider);

      suggestions = await StructuredOutputEnforcer.enforceJSON<Suggestion[]>(
        aiAdapter,
        params.systemPrompt,
        {
          schema: providerSchema as
            | { type: 'object' | 'array'; required?: string[]; items?: { required?: string[] }; additionalProperties?: boolean }
            | null,
          isArray: true,
          maxTokens: 2048,
          maxRetries: 2,
          temperature: params.temperature,
          operation: 'enhance_suggestions',
          provider,
          useStrictSchema: useStrictSchema && provider === 'openai',
        }
      );
    } else {
      usedContrastiveDecoding = true;

      // Calculate and log diversity metrics
      const diversityMetrics =
        this.contrastiveDiversity.calculateDiversityMetrics(suggestions);
      logger.info('Contrastive decoding diversity metrics', {
        avgSimilarity: diversityMetrics.avgSimilarity,
        minSimilarity: diversityMetrics.minSimilarity,
        maxSimilarity: diversityMetrics.maxSimilarity,
        pairCount: diversityMetrics.pairCount,
      });
    }

    const groqCallTime = Date.now() - groqStart;

    // Check for poisonous patterns
    const poisonousPatterns = POISONOUS_PATTERNS;
    const hasPoisonousText =
      Array.isArray(suggestions) &&
      suggestions.some((s) =>
        poisonousPatterns.some(
          (pattern) =>
            s.text?.toLowerCase().includes(pattern.toLowerCase()) ||
            s.text?.toLowerCase() === pattern.toLowerCase()
        )
      );

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
    }

    return {
      suggestions,
      groqCallTime,
      usedContrastiveDecoding,
    };
  }
}
