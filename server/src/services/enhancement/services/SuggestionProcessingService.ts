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

    const alignmentResult = this.applyCategoryAlignment(
      diverseSuggestions,
      params.highlightedCategory,
      params.highlightedText,
      params.highlightedCategoryConfidence ?? null
    );

    const sanitizedSuggestions = this.validationService.sanitizeSuggestions(
      alignmentResult.suggestions,
      sanitizationContext
    );
    const minSuggestionTarget = params.isVideoPrompt ? 3 : 0;
    const categorySeedResult = this._seedCategoryFallbacks({
      suggestions: sanitizedSuggestions,
      highlightedText: params.highlightedText,
      highlightedCategory: params.highlightedCategory,
      minSuggestionTarget,
      sanitizationContext,
    });

    const fallbackParams: FallbackRegenerationParams = {
      sanitizedSuggestions: categorySeedResult.suggestions,
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
    let usedFallback = categorySeedResult.seededCount > 0 || fallbackResult.usedFallback;
    let fallbackSourceCount = categorySeedResult.seededCount + fallbackResult.sourceCount;

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

    if (suggestionsToUse.length === 0) {
      const descriptorResult = this.applyDescriptorFallbacks(
        suggestionsToUse,
        params.highlightedText,
        params.fullPrompt
      );
      suggestionsToUse = descriptorResult.suggestions;
      if (descriptorResult.usedFallback) {
        usedFallback = true;
      }
      suggestionsToUse = this.validationService.sanitizeSuggestions(
        suggestionsToUse,
        sanitizationContext
      );
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
    highlightedText: string,
    fullPrompt: string
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
    const highlightedWordCount = highlightedText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const isDescriptorPhrase =
      descriptorDetection.confidence >= 0.7 && highlightedWordCount >= 3;

    logger.debug('Descriptor detection', {
      isDescriptorPhrase,
      category: descriptorDetection.category,
      confidence: descriptorDetection.confidence,
      highlightedWordCount,
    });

    if (!isDescriptorPhrase || !descriptorDetection.category) {
      return {
        suggestions: [],
        usedFallback: false,
        isDescriptorPhrase,
      };
    }

    const baseDescriptorFallbacks = getCategoryFallbacks(descriptorDetection.category) as Suggestion[];
    const childSceneDetected = this._isChildScene(fullPrompt);
    const descriptorFallbacks = childSceneDetected
      ? baseDescriptorFallbacks.filter(
          (fallback) => !this._containsAdultOrIncompatibleTerms(fallback.text)
        )
      : baseDescriptorFallbacks;

    if (descriptorFallbacks.length > 0) {
      logger.info('Using descriptor category fallbacks', {
        category: descriptorDetection.category,
        count: descriptorFallbacks.length,
        childSceneDetected,
      });

      return {
        suggestions: descriptorFallbacks,
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

  private _isChildScene(fullPrompt: string): boolean {
    if (typeof fullPrompt !== 'string' || !fullPrompt.trim()) {
      return false;
    }
    return /\b(baby|child|infant|toddler|newborn|kid)\b/i.test(fullPrompt);
  }

  private _containsAdultOrIncompatibleTerms(text: string): boolean {
    return /\b(weathered|athletic build|steel wrench|leather journal|graying temples|calloused|broad shoulders|wooden cane|fedora)\b/i.test(
      text
    );
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

  private _seedCategoryFallbacks({
    suggestions,
    highlightedText,
    highlightedCategory,
    minSuggestionTarget,
    sanitizationContext,
  }: {
    suggestions: Suggestion[];
    highlightedText: string;
    highlightedCategory: string | null;
    minSuggestionTarget: number;
    sanitizationContext: ExtendedSanitizationContext;
  }): { suggestions: Suggestion[]; seededCount: number } {
    if (!highlightedCategory || minSuggestionTarget <= 0 || suggestions.length >= minSuggestionTarget) {
      return { suggestions, seededCount: 0 };
    }

    if (typeof this.categoryAligner.getCategoryFallbacks !== 'function') {
      return { suggestions, seededCount: 0 };
    }

    const categoryFallbacks = this.categoryAligner.getCategoryFallbacks(
      highlightedText,
      highlightedCategory
    );

    if (!Array.isArray(categoryFallbacks) || categoryFallbacks.length === 0) {
      return { suggestions, seededCount: 0 };
    }

    const sanitizedFallbacks = this.validationService.sanitizeSuggestions(
      categoryFallbacks,
      sanitizationContext
    );

    if (sanitizedFallbacks.length === 0) {
      return { suggestions, seededCount: 0 };
    }

    const mergedSuggestions = this._mergeAndResanitizeSuggestions(
      suggestions,
      sanitizedFallbacks,
      sanitizationContext
    );

    const originalKeys = new Set(
      suggestions.map((suggestion) => this._normalizeSuggestionText(suggestion.text))
    );
    const seededCount = mergedSuggestions.reduce((count, suggestion) => {
      const key = this._normalizeSuggestionText(suggestion.text);
      return originalKeys.has(key) ? count : count + 1;
    }, 0);

    if (seededCount > 0) {
      logger.info('Seeded deterministic category fallbacks before regeneration', {
        highlightedCategory,
        seededCount,
        originalCount: suggestions.length,
        mergedCount: mergedSuggestions.length,
      });
    }

    return {
      suggestions: mergedSuggestions,
      seededCount,
    };
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
