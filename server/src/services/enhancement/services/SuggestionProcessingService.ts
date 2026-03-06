/**
 * SuggestionProcessingService
 *
 * Processes suggestions through diversity enforcement, category alignment, sanitization, and fallback.
 * Coordinates multiple processing steps to ensure high-quality suggestions.
 */

import { logger } from '@infrastructure/Logger';
import type {
  Suggestion,
  GroupedSuggestions,
  EnhancementResult,
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

type ExtendedSanitizationContext = Parameters<ValidationService['sanitizeSuggestions']>[1] & {
  contextBefore?: string;
  contextAfter?: string;
  spanAnchors?: string;
  nearbySpanHints?: string;
};

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
    const sanitizationContext = this._buildSanitizationContext(params);
    const diverseSuggestions = params.skipDiversityCheck
      ? params.suggestions
      : await this.diversityEnforcer.ensureDiverseSuggestions(params.suggestions);

    const echoFiltered = this.diversityEnforcer.filterOriginalEchoes(
      diverseSuggestions,
      params.highlightedText
    );

    const alignmentResult = this.applyCategoryAlignment(
      echoFiltered,
      params.highlightedCategory,
      params.highlightedText,
      params.highlightedCategoryConfidence ?? null
    );

    const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
      alignmentResult.suggestions,
      sanitizationContext
    );
    const minSuggestionTarget = params.isVideoPrompt ? 3 : 0;

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

    let suggestionsToUse = this.validationService.sanitizeSuggestions(
      fallbackResult.suggestions,
      sanitizationContext
    );
    let activeConstraints = fallbackResult.constraints;
    let usedFallback = fallbackResult.usedFallback;
    let fallbackSourceCount = fallbackResult.sourceCount;

    if (minSuggestionTarget > 0 && suggestionsToUse.length < minSuggestionTarget) {
      let topUpAttempts = 0;
      let topUpConstraints = activeConstraints || params.videoConstraints || undefined;

      while (suggestionsToUse.length < minSuggestionTarget && topUpAttempts < 3) {
        topUpAttempts += 1;
        const beforeCount = suggestionsToUse.length;

        const topUpFallbackParams: FallbackRegenerationParams = {
          ...fallbackParams,
          sanitizedSuggestions: [],
        };
        if (topUpConstraints) {
          topUpFallbackParams.videoConstraints = topUpConstraints;
        }

        const topUpResult =
          await this.fallbackRegeneration.attemptFallbackRegeneration(topUpFallbackParams);

        suggestionsToUse = this._mergeAndResanitizeSuggestions(
          suggestionsToUse,
          topUpResult.suggestions,
          sanitizationContext
        );
        if (topUpResult.constraints) {
          activeConstraints = topUpResult.constraints;
          topUpConstraints = topUpResult.constraints;
        }
        usedFallback = usedFallback || topUpResult.usedFallback;
        fallbackSourceCount += topUpResult.sourceCount;

        const gainedSuggestions = suggestionsToUse.length > beforeCount;
        const exhaustedAttempt =
          topUpResult.sourceCount === 0 &&
          topUpResult.suggestions.length === 0 &&
          !topUpResult.usedFallback;

        if (!gainedSuggestions && exhaustedAttempt) {
          break;
        }
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

  private _buildSanitizationContext(
    params: SuggestionProcessingParams
  ): ExtendedSanitizationContext {
    const sanitizationContext: ExtendedSanitizationContext = {
      highlightedText: params.highlightedText,
      highlightedCategory: params.highlightedCategory,
      isPlaceholder: params.isPlaceholder,
      isVideoPrompt: params.isVideoPrompt,
      ...(params.lockedSpanCategories
        ? { lockedSpanCategories: params.lockedSpanCategories }
        : {}),
      ...(params.videoConstraints ? { videoConstraints: params.videoConstraints } : {}),
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      ...(params.spanAnchors !== undefined ? { spanAnchors: params.spanAnchors } : {}),
      ...(params.nearbySpanHints !== undefined
        ? { nearbySpanHints: params.nearbySpanHints }
        : {}),
    };

    return sanitizationContext;
  }

  private _mergeAndResanitizeSuggestions(
    baseSuggestions: Suggestion[],
    additionalSuggestions: Suggestion[],
    context: ExtendedSanitizationContext
  ): Suggestion[] {
    const merged = [...baseSuggestions, ...additionalSuggestions];
    const deduped = this._dedupeSuggestions(merged);
    return this.validationService.sanitizeSuggestions(deduped, context);
  }

  private _dedupeSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    const deduped: Suggestion[] = [];

    for (const suggestion of suggestions) {
      const normalized = this._normalizeSuggestionText(suggestion.text);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      deduped.push(suggestion);
    }

    return deduped;
  }

  private _normalizeSuggestionText(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
