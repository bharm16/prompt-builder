import { logger } from "@infrastructure/Logger";
import { validateAgainstVideoTemplate } from "../config/CategoryConstraints.js";
import { getParentCategory } from "@shared/taxonomy";
import { getAllExampleTexts } from "../config/EnhancementExamples";
import type {
  Suggestion,
  SanitizationContext,
  GroupedSuggestions,
  VideoService,
  SuggestionRejectReason,
} from "./types.js";
import * as patterns from "./ValidationPatterns.js";
import { hasBodyPartSubRoleDrift } from "./SubjectAppearanceClassifier.js";
import { getCategoryDriftRejectReason } from "./CategoryDriftValidator.js";
import {
  hasObjectOverlap,
  hasActorDrift,
  hasSubjectClassDrift,
  isMetaphoricalOrAbstract,
  violatesArticleAgreement,
} from "./DriftDetectors.js";

type ExtendedSanitizationContext = SanitizationContext & {
  contextBefore?: string;
  contextAfter?: string;
  spanAnchors?: string;
  nearbySpanHints?: string;
};

interface SuggestionAnalysis {
  primary: Suggestion[];
  deprioritized: Suggestion[];
  rejected: Array<{ text: string; reason: SuggestionRejectReason }>;
}

/**
 * SuggestionValidationService
 *
 * Responsible for validating and sanitizing enhancement suggestions.
 * Ensures suggestions meet requirements and are valid drop-in replacements.
 *
 * Single Responsibility: Suggestion validation and sanitization
 */
export class SuggestionValidationService {
  private readonly log = logger.child({
    service: "SuggestionValidationService",
  });
  private readonly exampleTexts = getAllExampleTexts();
  private readonly compatibleLockedCategories: Record<string, Set<string>> = {
    camera: new Set(["shot"]),
    shot: new Set(["camera"]),
  };
  private readonly deprioritizedMarker = "__deprioritized";
  private readonly lockedCategoryPatterns = patterns.lockedCategoryPatterns;

  constructor(private readonly videoPromptService: VideoService) {}

  /**
   * Sanitize suggestions to ensure they are valid drop-in replacements
   * @param suggestions - Raw suggestions from Claude
   * @param context - Context for validation
   * @returns Sanitized suggestions
   */
  sanitizeSuggestions(
    suggestions: Suggestion[] | string[],
    context: SanitizationContext,
  ): Suggestion[] {
    const startTime = performance.now();
    const operation = "sanitizeSuggestions";

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      this.log.debug("Empty suggestions array, returning empty", {
        operation,
      });
      return [];
    }

    this.log.debug("Sanitizing suggestions", {
      operation,
      inputCount: suggestions.length,
      isVideoPrompt: context.isVideoPrompt,
      isPlaceholder: context.isPlaceholder,
    });

    const analysis = this.analyzeSuggestions(suggestions, context);
    const { primary, deprioritized, rejected } = analysis;

    const duration = Math.round(performance.now() - startTime);

    this.log.info("Suggestions sanitized", {
      operation,
      duration,
      inputCount: suggestions.length,
      primaryCount: primary.length,
      deprioritizedCount: deprioritized.length,
      filteredCount: rejected.length,
    });

    // Apply word count heuristics to primary suggestions only;
    // deprioritized suggestions always sort to the end
    const primaryRanked = this._applyPreferredWordCountHeuristics(
      primary,
      context,
    );
    return [...primaryRanked, ...deprioritized];
  }

  analyzeSuggestions(
    suggestions: Suggestion[] | string[],
    context: SanitizationContext,
  ): SuggestionAnalysis {
    const primary: Suggestion[] = [];
    const deprioritized: Suggestion[] = [];
    const rejected: Array<{ text: string; reason: SuggestionRejectReason }> =
      [];
    const extendedContext = context as ExtendedSanitizationContext;
    const normalizedHighlight = context.highlightedText?.trim().toLowerCase();
    const disallowedTemplatePatterns = [
      /\bmain prompt\b/i,
      /\btechnical specs?\b/i,
      /\balternative approaches\b/i,
    ];
    const disallowedPrefixes = [
      "consider",
      "try",
      "maybe",
      "you could",
      "focus on",
      "rewrite",
      "update",
      "suggest",
      "recommend",
    ];
    const oneClipPatterns = [
      /\band then\b/i,
      /\bstarts?\s+to\b/i,
      /\bbegins?\s+to\b/i,
      /\bnext\b/i,
    ];

    suggestions.forEach((suggestion) => {
      if (!suggestion) {
        return;
      }

      const suggestionObj: Suggestion =
        typeof suggestion === "string"
          ? { text: suggestion, explanation: "" }
          : { ...suggestion };

      if (typeof suggestionObj.text !== "string") {
        return;
      }

      let text = suggestionObj.text.replace(/^[0-9]+\.\s*/, "");
      text = text.replace(/\s+/g, " ").trim();
      let lowerText = text.toLowerCase();

      if (!text) {
        return;
      }

      if (normalizedHighlight && lowerText === normalizedHighlight) {
        rejected.push({ text, reason: "slot_form" });
        return;
      }

      if (this.exampleTexts.has(lowerText)) {
        rejected.push({ text, reason: "slot_form" });
        return;
      }

      if (/\r|\n/.test(text)) {
        rejected.push({ text, reason: "slot_form" });
        return;
      }

      if (disallowedTemplatePatterns.some((pattern) => pattern.test(text))) {
        rejected.push({ text, reason: "slot_form" });
        return;
      }

      const foundPrefix = disallowedPrefixes.find((prefix) =>
        lowerText.startsWith(prefix),
      );
      if (foundPrefix) {
        text = text.substring(foundPrefix.length).trim();
        if (!text) {
          rejected.push({ text: suggestionObj.text, reason: "slot_form" });
          return;
        }
        lowerText = text.toLowerCase();
      }

      text = this._stripContinuationOverlap(text, extendedContext);
      if (!text) {
        rejected.push({ text: suggestionObj.text, reason: "object_overlap" });
        return;
      }
      lowerText = text.toLowerCase();

      if (
        context.isVideoPrompt &&
        oneClipPatterns.some((pattern) => pattern.test(text))
      ) {
        rejected.push({ text, reason: "coherence_conflict" });
        return;
      }

      const lengthRejectReason = this._getLengthRejectReason(text, context);
      if (lengthRejectReason) {
        rejected.push({ text, reason: lengthRejectReason });
        return;
      }

      if (
        context.lockedSpanCategories &&
        context.lockedSpanCategories.length > 0
      ) {
        const targetParent = (
          getParentCategory(context.highlightedCategory) ||
          context.highlightedCategory ||
          ""
        ).toLowerCase();
        const compatibleSiblings =
          this.compatibleLockedCategories[targetParent] || new Set<string>();
        const lockedParents = Array.from(
          new Set(
            context.lockedSpanCategories
              .map((category) =>
                (getParentCategory(category) || category).toLowerCase(),
              )
              .filter(Boolean),
          ),
        ).filter(
          (category) =>
            category &&
            category !== targetParent &&
            !compatibleSiblings.has(category),
        );

        const hasConflict = lockedParents.some((category) => {
          const pattern = this.lockedCategoryPatterns[category];
          return pattern ? pattern.test(text) : false;
        });

        if (hasConflict) {
          rejected.push({ text, reason: "coherence_conflict" });
          return;
        }
      }

      const rejectReason = this._getHardRejectReason(text, extendedContext);
      if (rejectReason) {
        rejected.push({ text, reason: rejectReason });
        return;
      }

      const shouldDeprioritize = this._shouldDeprioritize(
        text,
        extendedContext,
      );
      const target = shouldDeprioritize ? deprioritized : primary;
      target.push(
        shouldDeprioritize
          ? {
              ...suggestionObj,
              text,
              [this.deprioritizedMarker]: true,
            }
          : {
              ...suggestionObj,
              text,
            },
      );
    });

    return { primary, deprioritized, rejected };
  }

  /**
   * Validate suggestions against category and template requirements
   * @param suggestions - Suggestions to validate
   * @param highlightedText - Original highlighted text
   * @param category - Category to validate against
   * @returns Validated suggestions
   */
  validateSuggestions(
    suggestions: Suggestion[],
    highlightedText: string,
    category: string,
  ): Suggestion[] {
    const operation = "validateSuggestions";

    if (!suggestions || !Array.isArray(suggestions)) {
      this.log.debug("Invalid suggestions input, returning empty", {
        operation,
      });
      return [];
    }

    this.log.debug("Validating suggestions", {
      operation,
      suggestionCount: suggestions.length,
      category,
      highlightLength: highlightedText.length,
    });

    const validationContext: ExtendedSanitizationContext = {
      highlightedText,
      highlightedCategory: category,
      isPlaceholder: false,
      isVideoPrompt: true,
    };

    const validated = suggestions.filter((suggestion) => {
      // Basic validation
      if (!suggestion.text || typeof suggestion.text !== "string") return false;

      // Skip audio suggestions for non-audio categories
      if (
        ["technical", "framing", "lighting", "descriptive"].includes(category)
      ) {
        if (/audio|sound|music|score|orchestra/i.test(suggestion.text)) {
          return false;
        }
      }

      if (this._getHardRejectReason(suggestion.text, validationContext)) {
        return false;
      }

      // Validate against video template requirements using taxonomy ID directly
      return validateAgainstVideoTemplate(suggestion, category);
    });

    this.log.info("Suggestions validated", {
      operation,
      inputCount: suggestions.length,
      outputCount: validated.length,
      category,
    });

    return validated;
  }

  private _getVideoPlaceholderFallbackConstraints(
    highlightedText: string | undefined,
  ): ReturnType<VideoService["getVideoReplacementConstraints"]> | undefined {
    const highlightWordCount = highlightedText
      ? this.videoPromptService.countWords(highlightedText)
      : undefined;

    try {
      return this.videoPromptService.getVideoReplacementConstraints({
        ...(highlightWordCount !== undefined ? { highlightWordCount } : {}),
        ...(highlightedText ? { highlightedText } : {}),
      });
    } catch (error) {
      this.log.warn(
        "Failed to derive fallback video constraints for placeholder sanitization",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return undefined;
    }
  }

  private _applyPreferredWordCountHeuristics(
    suggestions: Suggestion[],
    context: SanitizationContext,
  ): Suggestion[] {
    if (
      !context.isVideoPrompt ||
      suggestions.length === 0 ||
      !context.highlightedText
    ) {
      return suggestions;
    }

    const targetWords = this.videoPromptService.countWords(
      context.highlightedText,
    );
    if (targetWords <= 0) {
      return suggestions;
    }

    const preferredMin = Math.max(1, Math.floor(targetWords * 0.5));
    const preferredMax = Math.max(preferredMin, Math.ceil(targetWords * 1.5));

    const ranked = suggestions
      .map((suggestion, index) => {
        const suggestionWordCount = this.videoPromptService.countWords(
          suggestion.text,
        );
        const distance =
          Math.abs(suggestionWordCount - targetWords) /
          Math.max(targetWords, 1);
        return { suggestion, index, suggestionWordCount, distance };
      })
      .sort((a, b) => a.distance - b.distance || a.index - b.index);

    if (ranked.length > 3) {
      const inPreferredRange = ranked.filter(
        (entry) =>
          entry.suggestionWordCount >= preferredMin &&
          entry.suggestionWordCount <= preferredMax,
      );

      if (inPreferredRange.length >= 3) {
        // Keep out-of-range suggestions at the end instead of dropping them
        const outOfRange = ranked.filter(
          (entry) =>
            entry.suggestionWordCount < preferredMin ||
            entry.suggestionWordCount > preferredMax,
        );
        return [...inPreferredRange, ...outOfRange].map(
          (entry) => entry.suggestion,
        );
      }
    }

    return ranked.map((entry) => entry.suggestion);
  }

  /**
   * Group suggestions by their categories
   * @param suggestions - Array of suggestions with category field
   * @returns Grouped suggestions by category
   */
  groupSuggestionsByCategory(suggestions: Suggestion[]): GroupedSuggestions[] {
    const grouped: Record<string, Suggestion[]> = {};

    suggestions.forEach((suggestion) => {
      const category = suggestion.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(suggestion);
    });

    // Convert to array format for easier frontend handling
    return Object.entries(grouped).map(([category, items]) => ({
      category,
      suggestions: items,
    }));
  }

  private _getHardRejectReason(
    text: string,
    context: ExtendedSanitizationContext,
  ): SuggestionRejectReason | null {
    if (violatesArticleAgreement(text, context)) {
      return "slot_form";
    }

    const slotFitRejectReason = getCategoryDriftRejectReason(
      text,
      context,
      (input) => this.videoPromptService.countWords(input),
    );
    if (slotFitRejectReason) {
      return slotFitRejectReason;
    }

    if (hasBodyPartSubRoleDrift(text, context)) {
      return "body_part_drift";
    }

    if (hasObjectOverlap(text, context)) {
      return "object_overlap";
    }

    if (hasActorDrift(text, context)) {
      return "coherence_conflict";
    }

    if (hasSubjectClassDrift(text, context)) {
      return "category_drift";
    }

    if (isMetaphoricalOrAbstract(text, context)) {
      return "metaphor_or_abstract";
    }

    return null;
  }

  private _shouldDeprioritize(
    text: string,
    context: ExtendedSanitizationContext,
  ): boolean {
    void text;
    void context;
    return false;
  }

  private _getLengthRejectReason(
    text: string,
    context: SanitizationContext,
  ): SuggestionRejectReason | null {
    const category = this._normalizeCategoryKey(
      context.highlightedCategory || "",
    );
    const adverbLightingSlot =
      category === "lighting.quality" &&
      /ly$/i.test((context.highlightedText || "").trim().toLowerCase());
    const lowerText = text.toLowerCase();
    const wordCount = this.videoPromptService.countWords(text);

    if (context.isPlaceholder) {
      const fallbackVideoConstraints =
        context.isVideoPrompt && !context.videoConstraints
          ? this._getVideoPlaceholderFallbackConstraints(
              context.highlightedText,
            )
          : undefined;
      const constraints = {
        minWords: 1,
        maxWords: 4,
        maxSentences: 1,
        disallowTerminalPunctuation: true,
        ...(fallbackVideoConstraints || {}),
        ...(context.videoConstraints || {}),
      };

      const minWords = Number.isFinite(constraints.minWords)
        ? constraints.minWords!
        : 1;
      const maxWords = Number.isFinite(constraints.maxWords)
        ? constraints.maxWords!
        : 4;
      const maxSentences = Number.isFinite(constraints.maxSentences)
        ? constraints.maxSentences!
        : 1;

      if (wordCount < minWords || wordCount > maxWords) {
        return "length_only";
      }

      const sentenceCount = (text.match(/[.!?]/g) || []).length;
      if (maxSentences > 0 && sentenceCount > maxSentences) {
        return "length_only";
      }

      if (constraints.disallowTerminalPunctuation && /[.!?]$/.test(text)) {
        return "slot_form";
      }

      if (constraints.mode === "micro") {
        if (/[.!?]/.test(text)) {
          return "slot_form";
        }

        const commaCount = (text.match(/,/g) || []).length;
        if (commaCount > 1 || /[:;]/.test(text)) {
          return "slot_form";
        }

        if (/\b(is|are|was|were|be|being|been|am)\b/i.test(lowerText)) {
          return "slot_form";
        }
      }

      return null;
    }

    if (!context.isVideoPrompt) {
      return null;
    }

    const constraints = context.videoConstraints || {
      minWords: adverbLightingSlot ? 1 : 2,
      maxWords: adverbLightingSlot ? 3 : 50,
      maxSentences: 1,
    };

    const minWords = Number.isFinite(constraints.minWords)
      ? constraints.minWords!
      : 2;
    const maxWords = Number.isFinite(constraints.maxWords)
      ? constraints.maxWords!
      : 50;
    const maxSentences = Number.isFinite(constraints.maxSentences)
      ? constraints.maxSentences!
      : 1;

    if (wordCount < minWords || wordCount > maxWords) {
      return "length_only";
    }

    const sentenceCount = (text.match(/[.!?]/g) || []).length;
    if (maxSentences > 0 && sentenceCount > maxSentences) {
      return "length_only";
    }

    if (constraints.disallowTerminalPunctuation && /[.!?]$/.test(text)) {
      return "slot_form";
    }

    if (constraints.mode === "micro") {
      if (/[.!?]/.test(text)) {
        return "slot_form";
      }

      const commaCount = (text.match(/,/g) || []).length;
      if (commaCount > 1 || /[:;]/.test(text)) {
        return "slot_form";
      }

      if (/\b(is|are|was|were|be|being|been|am)\b/i.test(lowerText)) {
        return "slot_form";
      }
    }

    if (/\b(prompt|section|paragraph|rewrite|entire|overall)\b/i.test(text)) {
      return "slot_form";
    }

    return null;
  }

  /**
   * Strip trailing tokens from a suggestion that overlap with the start of contextAfter.
   * Only applies to action-category spans where the LLM may absorb the trailing object.
   */
  _stripContinuationOverlap(
    text: string,
    context: ExtendedSanitizationContext,
  ): string {
    const category = (context.highlightedCategory || "").toLowerCase();
    if (!category.startsWith("action")) return text;

    const after = context.contextAfter?.trim();
    if (!after) return text;

    const afterTokens = after.toLowerCase().split(/\s+/).slice(0, 6);
    const suggestionTokens = text.toLowerCase().split(/\s+/);

    if (afterTokens.length < 2 || suggestionTokens.length < 2) return text;

    // Check if the suggestion's tail matches the continuation's head
    // Try match lengths from 5 down to 2
    const maxMatch = Math.min(
      5,
      afterTokens.length,
      suggestionTokens.length - 1,
    );
    for (let n = maxMatch; n >= 2; n--) {
      const suggestionTail = suggestionTokens.slice(-n);
      const continuationHead = afterTokens.slice(0, n);
      if (suggestionTail.every((t, i) => t === continuationHead[i])) {
        // Strip the overlapping tail, preserving original casing
        const originalTokens = text.split(/\s+/);
        const stripped = originalTokens
          .slice(0, originalTokens.length - n)
          .join(" ")
          .trim();
        if (stripped) return stripped;
      }
    }

    return text;
  }

  private _normalizeCategoryKey(category: string): string {
    return category.toLowerCase().replace(/[_-]/g, "");
  }
}
