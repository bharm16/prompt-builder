/**
 * SuggestionProcessingService
 *
 * Processes suggestions through diversity enforcement, category alignment, sanitization, and fallback.
 * Coordinates multiple processing steps to ensure high-quality suggestions.
 */

import { logger } from '@infrastructure/Logger';
import {
  detectDescriptorCategory,
  getCategoryFallbacks,
} from '@services/video-concept/config/descriptorCategories';
import type {
  Suggestion,
  GroupedSuggestions,
  EnhancementResult,
  DescriptorFallbackResult,
  VideoConstraints,
  CategoryAlignmentResult,
  BrainstormContext,
  PromptBuildParams,
  FallbackRegenerationParams,
  DiversityEnforcer,
  ValidationService,
  CategoryAligner,
  AIService,
  OutputSchema,
  EditHistoryEntry,
} from './types';
import type { FallbackRegenerationService } from './FallbackRegenerationService';

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
  editHistory: EditHistoryEntry[];
  modelTarget: string | null;
  promptSection: string | null;
  spanAnchors?: string;
  nearbySpanHints?: string;
  focusGuidance?: string[];
  lockedSpanCategories?: string[];
  skipDiversityCheck?: boolean;
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
    private readonly ai: AIService
  ) {}

  /**
   * Process suggestions through diversity, alignment, sanitization, and fallback
   */
  async processSuggestions(
    params: SuggestionProcessingParams
  ): Promise<SuggestionProcessingResult> {
    const diverseSuggestions = params.skipDiversityCheck
      ? params.suggestions
      : await this.diversityEnforcer.ensureDiverseSuggestions(params.suggestions);

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
        highlightedCategory: params.highlightedCategory,
        isPlaceholder: params.isPlaceholder,
        isVideoPrompt: params.isVideoPrompt,
        ...(params.lockedSpanCategories ? { lockedSpanCategories: params.lockedSpanCategories } : {}),
        ...(params.videoConstraints ? { videoConstraints: params.videoConstraints } : {}),
      }
    );

    const fallbackParams: FallbackRegenerationParams = {
      sanitizedSuggestions,
      isVideoPrompt: params.isVideoPrompt,
      isPlaceholder: params.isPlaceholder,
      ...(params.lockedSpanCategories ? { lockedSpanCategories: params.lockedSpanCategories } : {}),
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
        ...(params.spanAnchors !== undefined ? { spanAnchors: params.spanAnchors } : {}),
        ...(params.nearbySpanHints !== undefined ? { nearbySpanHints: params.nearbySpanHints } : {}),
        ...(params.focusGuidance !== undefined ? { focusGuidance: params.focusGuidance } : {}),
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
      const descriptorResult = this.applyDescriptorFallbacks(suggestionsToUse, params.highlightedText);
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
   * Apply descriptor fallbacks if needed
   */
  applyDescriptorFallbacks(
    suggestions: Suggestion[],
    highlightedText: string
  ): DescriptorFallbackResult {
    if (suggestions.length > 0) {
      return {
        suggestions,
        usedFallback: false,
        isDescriptorPhrase: false,
      };
    }

    const descriptorDetection = detectDescriptorCategory(highlightedText) as {
      category: string | null;
      taxonomyId?: string | null;
      confidence: number;
    };
    const isDescriptorPhrase = descriptorDetection.confidence > 0.4;

    logger.debug('Descriptor detection', {
      isDescriptorPhrase,
      category: descriptorDetection.category,
      confidence: descriptorDetection.confidence,
    });

    if (!isDescriptorPhrase || !descriptorDetection.category) {
      return {
        suggestions: [],
        usedFallback: false,
        isDescriptorPhrase,
      };
    }

    const descriptorFallbacks = getCategoryFallbacks(descriptorDetection.category);

    if (descriptorFallbacks.length > 0) {
      logger.info('Using descriptor category fallbacks', {
        category: descriptorDetection.category,
        count: descriptorFallbacks.length,
      });

      return {
        suggestions: descriptorFallbacks as Suggestion[],
        usedFallback: true,
        isDescriptorPhrase,
        descriptorCategory: descriptorDetection.category,
      };
    }

    return {
      suggestions: [],
      usedFallback: false,
      isDescriptorPhrase,
    };
  }

  /**
   * Group suggestions by category if applicable
   */
  groupSuggestions(suggestions: Suggestion[], isPlaceholder: boolean): Suggestion[] | GroupedSuggestions[] {
    if (isPlaceholder && suggestions[0]?.category) {
      return this.validationService.groupSuggestionsByCategory(suggestions);
    }
    return suggestions;
  }

  /**
   * Build final result object
   */
  buildResult({
    groupedSuggestions,
    isPlaceholder,
    phraseRole,
    activeConstraints,
    alignmentFallbackApplied,
    usedFallback,
    hasNoSuggestions,
  }: {
    groupedSuggestions: Suggestion[] | GroupedSuggestions[];
    isPlaceholder: boolean;
    phraseRole?: string | null;
    activeConstraints?: { mode?: string } | null;
    alignmentFallbackApplied?: boolean;
    usedFallback?: boolean;
    hasNoSuggestions?: boolean;
  }): EnhancementResult {
    const result: EnhancementResult = {
      suggestions: groupedSuggestions,
      isPlaceholder,
      hasCategories:
        isPlaceholder &&
        Array.isArray(groupedSuggestions) &&
        groupedSuggestions[0] &&
        'suggestions' in groupedSuggestions[0]
          ? true
          : false,
      phraseRole: phraseRole || null,
      appliedConstraintMode: activeConstraints?.mode || null,
      fallbackApplied: alignmentFallbackApplied || usedFallback || false,
    };

    if (activeConstraints) {
      result.appliedVideoConstraints = activeConstraints as {
        mode?: string;
        [key: string]: unknown;
      };
    }

    if (hasNoSuggestions) {
      result.noSuggestionsReason =
        'No template-compliant drop-in replacements were generated for this highlight.';
    }

    return result;
  }

  /**
   * Log result metadata
   */
  logResult(
    result: EnhancementResult,
    sanitizedSuggestions: Suggestion[],
    usedFallback: boolean,
    fallbackSourceCount: number,
    baseSuggestions: Suggestion[]
  ): void {
    const groupedSuggestions = result.suggestions;

    logger.info('Final result structure', {
      isGrouped:
        Array.isArray(groupedSuggestions) &&
        groupedSuggestions[0] &&
        'suggestions' in groupedSuggestions[0],
      categoriesCount:
        Array.isArray(groupedSuggestions) &&
        groupedSuggestions[0] &&
        'suggestions' in groupedSuggestions[0]
          ? groupedSuggestions.length
          : 0,
      hasCategories: result.hasCategories,
      appliedConstraintMode: result.appliedConstraintMode || null,
    });

    let baseSuggestionCount: number;
    if (usedFallback) {
      baseSuggestionCount = fallbackSourceCount;
    } else if (Array.isArray(baseSuggestions)) {
      baseSuggestionCount = baseSuggestions.length;
    } else {
      baseSuggestionCount = 0;
    }

    logger.info('Enhancement suggestions generated', {
      count: sanitizedSuggestions.length,
      type: result.isPlaceholder ? 'placeholder' : 'rewrite',
      diversityEnforced: sanitizedSuggestions.length !== baseSuggestionCount,
      appliedConstraintMode: result.appliedConstraintMode || null,
      usedFallback,
    });
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
