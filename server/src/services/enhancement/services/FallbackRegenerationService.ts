import { logger } from "@infrastructure/Logger";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import type {
  Suggestion,
  VideoService,
  AIService,
  FallbackRegenerationParams,
  FallbackRegenerationResult,
  PromptBuildParams,
  SuggestionRejectReason,
  VideoConstraints,
  OutputSchema,
} from "./types.js";

/**
 * Interface for prompt builder
 */
interface PromptBuilder {
  buildRewritePrompt(params: PromptBuildParams): string;
}

/**
 * Interface for validation service
 */
interface ValidationService {
  sanitizeSuggestions(
    suggestions: Suggestion[],
    context: {
      highlightedText?: string;
      isPlaceholder?: boolean;
      isVideoPrompt?: boolean;
      videoConstraints?: VideoConstraints;
      highlightedCategory?: string | null;
      lockedSpanCategories?: string[];
      contextBefore?: string;
      contextAfter?: string;
      spanAnchors?: string;
      nearbySpanHints?: string;
    },
  ): Suggestion[];
  analyzeSuggestions?(
    suggestions: Suggestion[],
    context: {
      highlightedText?: string;
      isPlaceholder?: boolean;
      isVideoPrompt?: boolean;
      videoConstraints?: VideoConstraints;
      highlightedCategory?: string | null;
      lockedSpanCategories?: string[];
      contextBefore?: string;
      contextAfter?: string;
      spanAnchors?: string;
      nearbySpanHints?: string;
    },
  ): {
    primary: Suggestion[];
    deprioritized: Suggestion[];
    rejected: Array<{ text: string; reason: SuggestionRejectReason }>;
  };
}

/**
 * Interface for diversity enforcer
 */
interface DiversityEnforcer {
  ensureDiverseSuggestions(suggestions: Suggestion[]): Promise<Suggestion[]>;
}

type RejectSummary = Partial<Record<SuggestionRejectReason, number>>;

type InternalFallbackResult = FallbackRegenerationResult & {
  rejectionSummary?: RejectSummary;
};

/**
 * Service responsible for fallback regeneration when initial suggestions fail validation
 * Implements iterative fallback strategy for video prompts
 */
export class FallbackRegenerationService {
  constructor(
    private readonly videoPromptService: VideoService,
    private readonly promptBuilder: PromptBuilder,
    private readonly validationService: ValidationService,
    private readonly diversityEnforcer: DiversityEnforcer,
  ) {}

  /**
   * Attempt fallback regeneration with different constraint modes
   * @param params - Regeneration parameters
   * @returns Regeneration result with suggestions and metadata
   */
  async attemptFallbackRegeneration(
    params: FallbackRegenerationParams,
  ): Promise<FallbackRegenerationResult> {
    const {
      sanitizedSuggestions,
      isVideoPrompt,
      isPlaceholder,
      videoConstraints,
      lockedSpanCategories,
      regenerationDetails,
      requestParams,
      aiService,
      schema,
      temperature,
    } = params;

    // Early return only when we already have valid suggestions
    if (sanitizedSuggestions.length > 0) {
      const result: FallbackRegenerationResult = {
        suggestions: sanitizedSuggestions,
        usedFallback: false,
        sourceCount: 0,
      };
      if (videoConstraints) {
        result.constraints = videoConstraints;
      }
      return result;
    }

    logger.warn("All suggestions removed during sanitization", {
      highlightWordCount: regenerationDetails.highlightWordCount,
      phraseRole: regenerationDetails.phraseRole ?? null,
      constraintMode: videoConstraints?.mode ?? null,
    });

    // Initialize fallback state
    const attemptedModes = new Set<string>();
    if (videoConstraints?.mode) {
      attemptedModes.add(videoConstraints.mode);
    }

    const highlightedCategory =
      requestParams.highlightedCategory ||
      regenerationDetails.highlightedCategory ||
      undefined;
    let rejectSummary: RejectSummary = {};

    let inCategoryConstraints = this._adaptConstraintsForReasons(
      videoConstraints || {},
      highlightedCategory,
      requestParams.highlightedText,
      rejectSummary,
      true,
    );
    const attemptedInCategory = new Set<string>();

    for (
      let retryCount = 0;
      retryCount < 3 && inCategoryConstraints.mode;
      retryCount += 1
    ) {
      const retrySignature = JSON.stringify(inCategoryConstraints);
      if (attemptedInCategory.has(retrySignature)) {
        break;
      }
      attemptedInCategory.add(retrySignature);

      try {
        const result = await this._attemptSingleFallback({
          fallbackConstraints: inCategoryConstraints,
          requestParams,
          aiService,
          schema,
          temperature,
          isPlaceholder,
          isVideoPrompt,
          ...(lockedSpanCategories !== undefined
            ? { lockedSpanCategories }
            : {}),
        });

        if (result.suggestions.length > 0) {
          return result;
        }

        rejectSummary = result.rejectionSummary || rejectSummary;
      } catch (error) {
        logger.warn("In-category fallback regeneration failed", {
          mode: inCategoryConstraints.mode,
          highlightedCategory: highlightedCategory ?? null,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      inCategoryConstraints = this._adaptConstraintsForReasons(
        inCategoryConstraints,
        highlightedCategory,
        requestParams.highlightedText,
        rejectSummary,
        true,
      );
    }

    let currentConstraints = videoConstraints;
    let fallbackConstraints =
      this.videoPromptService.getVideoFallbackConstraints(
        currentConstraints,
        regenerationDetails,
        attemptedModes,
      );
    fallbackConstraints = fallbackConstraints
      ? this._adaptConstraintsForReasons(
          fallbackConstraints,
          highlightedCategory,
          requestParams.highlightedText,
          rejectSummary,
        )
      : null;

    // Iterative fallback loop
    while (fallbackConstraints) {
      try {
        // Try regeneration with fallback constraints
        const result = await this._attemptSingleFallback({
          fallbackConstraints,
          requestParams,
          aiService,
          schema,
          temperature,
          isPlaceholder,
          isVideoPrompt,
          ...(lockedSpanCategories !== undefined
            ? { lockedSpanCategories }
            : {}),
        });

        if (result.suggestions.length > 0) {
          return result;
        }

        rejectSummary = result.rejectionSummary || rejectSummary;

        // Log unsuccessful attempt
        logger.warn("Fallback attempt yielded no compliant suggestions", {
          modeTried: fallbackConstraints.mode,
          generatedCount: result.rawCount,
          sanitizedCount: result.suggestions.length,
          rejectSummary,
        });
      } catch (error) {
        logger.warn("Fallback regeneration failed", {
          mode: fallbackConstraints.mode,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Move to next fallback
      attemptedModes.add(fallbackConstraints.mode || "");
      currentConstraints = fallbackConstraints;
      fallbackConstraints = this.videoPromptService.getVideoFallbackConstraints(
        currentConstraints,
        regenerationDetails,
        attemptedModes,
      );
      fallbackConstraints = fallbackConstraints
        ? this._adaptConstraintsForReasons(
            fallbackConstraints,
            highlightedCategory,
            requestParams.highlightedText,
            rejectSummary,
          )
        : null;
    }

    // No successful fallback found
    const result: FallbackRegenerationResult = {
      suggestions: [],
      usedFallback: false,
      sourceCount: 0,
    };
    if (videoConstraints) {
      result.constraints = videoConstraints;
    }
    return result;
  }

  /**
   * Attempt a single fallback regeneration
   * @private
   */
  private async _attemptSingleFallback({
    fallbackConstraints,
    requestParams,
    aiService,
    schema,
    temperature,
    isPlaceholder,
    isVideoPrompt,
    lockedSpanCategories,
  }: {
    fallbackConstraints: VideoConstraints;
    requestParams: PromptBuildParams;
    aiService: AIService;
    schema: OutputSchema;
    temperature: number;
    isPlaceholder: boolean;
    isVideoPrompt: boolean;
    lockedSpanCategories?: string[];
  }): Promise<InternalFallbackResult> {
    // Build fallback prompt
    const fallbackPrompt = this.promptBuilder.buildRewritePrompt({
      ...requestParams,
      videoConstraints: fallbackConstraints,
    });

    // Generate suggestions using aiService
    const fallbackSuggestions = (await StructuredOutputEnforcer.enforceJSON(
      aiService,
      fallbackPrompt,
      {
        operation: "enhance_fallback",
        schema,
        isArray: true,
        maxTokens: 2048,
        maxRetries: 1,
        temperature,
      },
    )) as Suggestion[];

    // Process suggestions
    const fallbackDiverse =
      await this.diversityEnforcer.ensureDiverseSuggestions(
        fallbackSuggestions,
      );

    // Build sanitization context, only including defined values
    const sanitizationContext: {
      highlightedText?: string;
      isPlaceholder?: boolean;
      isVideoPrompt?: boolean;
      videoConstraints?: VideoConstraints;
      highlightedCategory?: string | null;
      lockedSpanCategories?: string[];
      contextBefore?: string;
      contextAfter?: string;
      spanAnchors?: string;
      nearbySpanHints?: string;
    } = {
      isPlaceholder,
      isVideoPrompt,
      videoConstraints: fallbackConstraints,
    };
    if (requestParams.highlightedText !== undefined) {
      sanitizationContext.highlightedText = requestParams.highlightedText;
    }
    if (requestParams.highlightedCategory !== undefined) {
      sanitizationContext.highlightedCategory =
        requestParams.highlightedCategory;
    }
    if (lockedSpanCategories && lockedSpanCategories.length > 0) {
      sanitizationContext.lockedSpanCategories = lockedSpanCategories;
    }
    if (requestParams.contextBefore !== undefined) {
      sanitizationContext.contextBefore = requestParams.contextBefore;
    }
    if (requestParams.contextAfter !== undefined) {
      sanitizationContext.contextAfter = requestParams.contextAfter;
    }
    if (requestParams.spanAnchors !== undefined) {
      sanitizationContext.spanAnchors = requestParams.spanAnchors;
    }
    if (requestParams.nearbySpanHints !== undefined) {
      sanitizationContext.nearbySpanHints = requestParams.nearbySpanHints;
    }

    const validationAnalysis = this.validationService.analyzeSuggestions
      ? this.validationService.analyzeSuggestions(
          fallbackDiverse,
          sanitizationContext,
        )
      : {
          primary: this.validationService.sanitizeSuggestions(
            fallbackDiverse,
            sanitizationContext,
          ),
          deprioritized: [],
          rejected: [],
        };
    const fallbackSanitized = [
      ...validationAnalysis.primary,
      ...validationAnalysis.deprioritized,
    ];

    return {
      suggestions: fallbackSanitized,
      constraints: fallbackConstraints,
      usedFallback: fallbackSanitized.length > 0,
      sourceCount: Array.isArray(fallbackSuggestions)
        ? fallbackSuggestions.length
        : 0,
      rawCount: Array.isArray(fallbackSuggestions)
        ? fallbackSuggestions.length
        : 0,
      rejectionSummary: this._summarizeRejectReasons(
        validationAnalysis.rejected,
      ),
    };
  }

  private _adaptConstraintsForReasons(
    constraints: VideoConstraints,
    highlightedCategory: string | undefined,
    highlightedText: string | undefined,
    rejectSummary: RejectSummary,
    preserveCategoryMode = false,
  ): VideoConstraints {
    const category = (highlightedCategory || "").toLowerCase();
    const adapted: VideoConstraints = {
      ...constraints,
      focusGuidance: [...(constraints.focusGuidance || [])],
      extraRequirements: [...(constraints.extraRequirements || [])],
    };

    if (preserveCategoryMode) {
      const nextMode = this._getSameCategoryMode(category, adapted.mode);
      if (nextMode) {
        adapted.mode = nextMode;
      }
    }

    if (category === "environment.location") {
      if (preserveCategoryMode) adapted.mode = "location";
      adapted.minWords = 2;
      adapted.maxWords = 5;
      adapted.formRequirement =
        "2-5 word external location phrase with atmosphere";
    } else if (category === "environment.context") {
      if (preserveCategoryMode) adapted.mode = "phrase";
      adapted.minWords = 2;
      adapted.maxWords = 6;
      adapted.formRequirement =
        "2-6 word in-scene environmental context phrase";
    } else if (category === "camera.lens") {
      if (preserveCategoryMode) adapted.mode = "phrase";
      adapted.minWords = 1;
      adapted.maxWords = 4;
      adapted.formRequirement = "1-4 word lens or aperture phrase only";
    } else if (category === "lighting.timeofday") {
      if (preserveCategoryMode) adapted.mode = "adjective";
      adapted.minWords = 1;
      adapted.maxWords = 4;
      adapted.formRequirement = "1-4 word time-of-day or daylight phrase only";
    } else if (
      category === "lighting.quality" &&
      this._isLikelyAdverbSlot(highlightedText)
    ) {
      if (preserveCategoryMode) adapted.mode = "adjective";
      adapted.minWords = 1;
      adapted.maxWords = 3;
      adapted.formRequirement =
        "1-3 word adverbial lighting-quality phrase only";
    } else if (category.startsWith("action.")) {
      if (preserveCategoryMode) adapted.mode = "verb";
    }

    if ((rejectSummary.length_only || 0) > 0) {
      adapted.minWords = Math.min(adapted.minWords ?? 1, 2);
      adapted.maxWords = Math.min(
        adapted.maxWords ?? this._getShortSpanMaxWords(category),
        this._getShortSpanMaxWords(category),
      );
      adapted.extraRequirements = [
        ...(adapted.extraRequirements || []),
        "Prefer the shortest compliant phrase within these bounds",
      ];
    }

    if ((rejectSummary.slot_form || 0) > 0) {
      adapted.extraRequirements = [
        ...(adapted.extraRequirements || []),
        "Match the exact grammatical slot of the highlighted text",
      ];
    }

    if ((rejectSummary.category_drift || 0) > 0) {
      adapted.extraRequirements = [
        ...(adapted.extraRequirements || []),
        "Stay strictly inside the same taxonomy category as the highlighted span",
      ];
    }

    if ((rejectSummary.body_part_drift || 0) > 0) {
      adapted.extraRequirements = [
        ...(adapted.extraRequirements || []),
        "Preserve the same body-part role; do not switch to a different body part or prop",
      ];
    }

    if ((rejectSummary.object_overlap || 0) > 0) {
      adapted.extraRequirements = [
        ...(adapted.extraRequirements || []),
        "Do not mention or repeat the trailing object that follows the highlighted span",
      ];
    }

    if ((rejectSummary.metaphor_or_abstract || 0) > 0) {
      adapted.extraRequirements = [
        ...(adapted.extraRequirements || []),
        "Avoid poetic or abstract phrasing; use camera-visible, literal wording only",
      ];
    }

    adapted.focusGuidance = Array.from(new Set(adapted.focusGuidance));
    adapted.extraRequirements = Array.from(new Set(adapted.extraRequirements));

    return adapted;
  }

  private _getSameCategoryMode(
    category: string,
    currentMode?: string,
  ): string | undefined {
    if (category === "environment.location") return "location";
    if (category === "environment.context") return "phrase";
    if (category === "camera.lens") return "phrase";
    if (category === "lighting.timeofday") return "adjective";
    if (category === "lighting.quality") return "adjective";
    if (category.startsWith("action.")) return "verb";
    return currentMode;
  }

  private _getShortSpanMaxWords(category: string): number {
    if (category === "environment.location") return 5;
    if (category === "environment.context") return 6;
    if (category === "camera.lens") return 4;
    if (category === "lighting.timeofday") return 4;
    if (category === "lighting.quality") return 3;
    return 6;
  }

  private _isLikelyAdverbSlot(highlightedText: string | undefined): boolean {
    const normalized = (highlightedText || "").trim().toLowerCase();
    return normalized.endsWith("ly") || normalized === "intensely";
  }

  private _summarizeRejectReasons(
    rejected: Array<{ text: string; reason: SuggestionRejectReason }>,
  ): RejectSummary {
    return rejected.reduce<RejectSummary>((summary, item) => {
      summary[item.reason] = (summary[item.reason] || 0) + 1;
      return summary;
    }, {});
  }
}
