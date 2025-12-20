/**
 * SuggestionProcessingService
 *
 * Processes suggestions through diversity enforcement, category alignment, sanitization, and fallback.
 * Coordinates multiple processing steps to ensure high-quality suggestions.
 */

import { logger } from '@infrastructure/Logger';
import type {
  Suggestion,
  VideoConstraints,
  CategoryAlignmentResult,
  BrainstormContext,
  PromptBuildParams,
  FallbackRegenerationParams,
  FallbackRegenerationResult,
  DiversityEnforcer,
  ValidationService,
  CategoryAligner,
  AIService,
  OutputSchema,
} from './types';
import type { FallbackRegenerationService } from './FallbackRegenerationService';
import type { SuggestionProcessor } from './SuggestionProcessor';

export interface SuggestionProcessingParams {
  suggestions: Suggestion[];
  highlightedCategory: string | null;
  highlightedText: string;
  highlightedCategoryConfidence: number | null | undefined;
  isPlaceholder: boolean;
  isVideoPrompt: boolean;
  videoConstraints: VideoConstraints | null;
  phraseRole: string | null;
  highlightWordCount: number;
  schema: OutputSchema;
  temperature: number;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  brainstormContext: BrainstormContext | null;
  editHistory: Array<{ original?: string; category?: string }>;
  modelTarget: string | null;
  promptSection: string | null;
}

export interface SuggestionProcessingResult {
  suggestionsToUse: Suggestion[];
  activeConstraints: VideoConstraints | undefined;
  alignmentFallbackApplied: boolean;
  usedFallback: boolean;
  fallbackSourceCount: number;
}

/**
 * Service for processing enhancement suggestions
 */
export class SuggestionProcessingService {
  constructor(
    private readonly diversityEnforcer: DiversityEnforcer,
    private readonly validationService: ValidationService,
    private readonly categoryAligner: CategoryAligner,
    private readonly fallbackRegeneration: FallbackRegenerationService,
    private readonly suggestionProcessor: SuggestionProcessor,
    private readonly ai: AIService
  ) {}

  /**
   * Process suggestions through diversity, alignment, sanitization, and fallback
   */
  async processSuggestions(
    params: SuggestionProcessingParams
  ): Promise<SuggestionProcessingResult> {
    const diverseSuggestions = await this.diversityEnforcer.ensureDiverseSuggestions(
      params.suggestions
    );

    const alignmentResult = this.applyCategoryAlignment(
      diverseSuggestions,
      params.highlightedCategory,
      params.highlightedText,
      params.highlightedCategoryConfidence ?? null
    );

    const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
      alignmentResult.suggestions,
      {
        highlightedText: params.highlightedText,
        isPlaceholder: params.isPlaceholder,
        isVideoPrompt: params.isVideoPrompt,
        ...(params.videoConstraints ? { videoConstraints: params.videoConstraints } : {}),
      }
    );

    const fallbackParams: FallbackRegenerationParams = {
      sanitizedSuggestions,
      isVideoPrompt: params.isVideoPrompt,
      isPlaceholder: params.isPlaceholder,
      regenerationDetails: {
        highlightWordCount: params.highlightWordCount,
      },
      requestParams: {
        highlightedText: params.highlightedText,
        contextBefore: params.contextBefore,
        contextAfter: params.contextAfter,
        fullPrompt: params.fullPrompt,
        originalUserPrompt: params.originalUserPrompt,
        isVideoPrompt: params.isVideoPrompt,
        isPlaceholder: params.isPlaceholder,
        brainstormContext: params.brainstormContext,
        phraseRole: params.phraseRole,
        highlightWordCount: params.highlightWordCount,
        highlightedCategory: params.highlightedCategory,
        highlightedCategoryConfidence: params.highlightedCategoryConfidence ?? null,
        editHistory: params.editHistory,
        modelTarget: params.modelTarget,
        promptSection: params.promptSection,
      },
      aiService: this.ai,
      schema: params.schema,
      temperature: params.temperature,
    };
    if (params.videoConstraints) fallbackParams.videoConstraints = params.videoConstraints;
    if (params.phraseRole) fallbackParams.regenerationDetails.phraseRole = params.phraseRole;
    if (params.highlightedText)
      fallbackParams.regenerationDetails.highlightedText = params.highlightedText;
    if (params.highlightedCategory)
      fallbackParams.regenerationDetails.highlightedCategory = params.highlightedCategory;
    if (
      params.highlightedCategoryConfidence !== null &&
      params.highlightedCategoryConfidence !== undefined
    ) {
      fallbackParams.regenerationDetails.highlightedCategoryConfidence =
        params.highlightedCategoryConfidence;
    }

    const fallbackResult =
      await this.fallbackRegeneration.attemptFallbackRegeneration(fallbackParams);

    let suggestionsToUse = fallbackResult.suggestions;
    const activeConstraints = fallbackResult.constraints;
    let usedFallback = fallbackResult.usedFallback;
    const fallbackSourceCount = fallbackResult.sourceCount;

    if (suggestionsToUse.length === 0) {
      const descriptorResult = this.suggestionProcessor.applyDescriptorFallbacks(
        suggestionsToUse,
        params.highlightedText
      );
      suggestionsToUse = descriptorResult.suggestions;
      if (descriptorResult.usedFallback) {
        usedFallback = true;
      }
    }

    logger.info('Processing suggestions for categorization', {
      isPlaceholder: params.isPlaceholder,
      hasCategoryField: suggestionsToUse[0]?.category !== undefined,
      totalSuggestions: suggestionsToUse.length,
      sanitizedCount: sanitizedSuggestions.length,
      appliedConstraintMode: activeConstraints?.mode || null,
      usedFallback,
    });

    return {
      suggestionsToUse,
      activeConstraints,
      alignmentFallbackApplied: alignmentResult.fallbackApplied,
      usedFallback,
      fallbackSourceCount,
    };
  }

  /**
   * Apply category alignment if needed
   * @private
   */
  private applyCategoryAlignment(
    suggestions: Suggestion[],
    highlightedCategory: string | null,
    highlightedText: string,
    confidence: number | null
  ): CategoryAlignmentResult {
    if (!highlightedCategory) {
      return { suggestions, fallbackApplied: false, context: {} };
    }

    const alignmentResult = this.categoryAligner.enforceCategoryAlignment(suggestions, {
      highlightedText,
      highlightedCategory,
      ...(confidence !== null && confidence !== undefined
        ? { highlightedCategoryConfidence: confidence }
        : {}),
    });

    if (alignmentResult.fallbackApplied) {
      logger.info('Applied category fallbacks', {
        highlightedText,
        category: highlightedCategory,
        reason: alignmentResult.context.reason,
      });
    }

    return alignmentResult;
  }
}

