import { getParentCategory } from "@shared/taxonomy";
import type { Suggestion, VideoService } from "../services/types.js";
import type {
  CandidateEvaluation,
  EnhancementV2RequestContext,
  SlotPolicy,
} from "./types.js";
import {
  ACTION_OBJECT_TERMS,
  BODY_PART_PATTERNS,
  CATEGORY_LOCK_PATTERNS,
  SEMANTIC_FAMILY_PATTERNS,
} from "./policies/semanticFamilies.js";

const DISALLOWED_PREFIXES = [
  "consider",
  "try",
  "maybe",
  "you could",
  "focus on",
  "rewrite",
  "update",
  "suggest",
  "recommend",
] as const;

const ABSTRACT_DISALLOWED =
  /\b(hush|cascade|whisper|dream|memory|sentiment|essence|timeless|poetic|ethereal)\b/i;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "with",
  "and",
  "of",
  "in",
  "on",
  "for",
  "to",
  "by",
  "at",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "its",
  "it",
  "or",
  "into",
]);

export class V2CandidateScorer {
  constructor(private readonly videoService: VideoService) {}

  scoreCandidates(
    suggestions: Suggestion[],
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): CandidateEvaluation[] {
    return suggestions.map((suggestion) =>
      this.evaluateCandidate(suggestion, context, policy),
    );
  }

  rankAcceptedCandidates(
    evaluations: CandidateEvaluation[],
    targetCount: number,
  ): Suggestion[] {
    const accepted = evaluations.filter((entry) => entry.accepted);
    const ranked = accepted.sort((a, b) => b.score.total - a.score.total);
    const selected: CandidateEvaluation[] = [];

    for (const candidate of ranked) {
      const isTooSimilar = selected.some((existing) => {
        const similarity = this._similarity(
          existing.suggestion.text,
          candidate.suggestion.text,
        );
        return similarity > 0.7;
      });
      if (isTooSimilar) {
        continue;
      }
      selected.push(candidate);
      if (selected.length >= targetCount) {
        break;
      }
    }

    return selected.map((entry) => entry.suggestion);
  }

  summarizeRejections(
    evaluations: CandidateEvaluation[],
  ): Record<string, number> {
    return evaluations.reduce<Record<string, number>>((summary, entry) => {
      if (entry.accepted) {
        return summary;
      }
      if (entry.reasons.length === 0) {
        summary.unknown = (summary.unknown || 0) + 1;
        return summary;
      }
      for (const reason of entry.reasons) {
        summary[reason] = (summary[reason] || 0) + 1;
      }
      return summary;
    }, {});
  }

  private evaluateCandidate(
    suggestion: Suggestion,
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): CandidateEvaluation {
    const reasons: string[] = [];
    const normalizedSuggestion = this._normalizeSuggestion(suggestion, context);
    const text = normalizedSuggestion.text;
    const normalizedHighlight = context.highlightedText.trim().toLowerCase();
    const weights = policy.scorerWeights || {
      familyFit: 0.45,
      contextFit: 0.25,
      literalness: 0.2,
      overlapPenalty: 0.1,
    };

    if (!text) {
      reasons.push("empty");
    }

    if (text.toLowerCase() === normalizedHighlight) {
      reasons.push("highlight_echo");
    }

    if (/\r|\n/.test(text)) {
      reasons.push("multiline");
    }

    const wordCount = this.videoService.countWords(text);
    if (
      wordCount < policy.grammar.minWords ||
      wordCount > policy.grammar.maxWords
    ) {
      reasons.push("word_bounds");
    }

    if (!this._matchesGrammar(text, policy)) {
      reasons.push("grammar");
    }

    const requiredMatches = policy.requiredFamilies.filter((family) =>
      SEMANTIC_FAMILY_PATTERNS[family].test(text),
    );
    if (policy.requiredFamilies.length > 0 && requiredMatches.length === 0) {
      reasons.push("family_miss");
    }

    const forbiddenMatches = policy.forbiddenFamilies.filter((family) =>
      SEMANTIC_FAMILY_PATTERNS[family].test(text),
    );
    if (forbiddenMatches.length > 0) {
      reasons.push("forbidden_family");
    }

    if (this._hasLockedCategoryConflict(text, context, policy)) {
      reasons.push("locked_conflict");
    }

    if (this._hasBodyPartDrift(text, context)) {
      reasons.push("body_part_drift");
    }

    if (this._hasObjectOverlap(text, context)) {
      reasons.push("object_overlap");
    }

    const isAbstract = ABSTRACT_DISALLOWED.test(text);
    if (isAbstract && policy.categoryId !== "style.aesthetic") {
      reasons.push("abstract");
    }

    const familyFit =
      policy.requiredFamilies.length === 0
        ? 1
        : requiredMatches.length / policy.requiredFamilies.length;
    const contextFit = this._contextFit(text, context);
    const literalness = isAbstract ? 0 : 1;
    const overlapPenalty = this._computeOverlapPenalty(text, context);
    const total =
      familyFit * weights.familyFit +
      contextFit * weights.contextFit +
      literalness * weights.literalness -
      overlapPenalty * weights.overlapPenalty;

    return {
      suggestion: normalizedSuggestion,
      accepted: reasons.length === 0,
      score: {
        familyFit,
        contextFit,
        literalness,
        overlapPenalty,
        total,
      },
      reasons,
    };
  }

  private _normalizeSuggestion(
    suggestion: Suggestion,
    context: EnhancementV2RequestContext,
  ): Suggestion {
    let text = (suggestion.text || "")
      .replace(/^[0-9]+\.\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    let lowerText = text.toLowerCase();

    const prefix = DISALLOWED_PREFIXES.find((value) =>
      lowerText.startsWith(value),
    );
    if (prefix) {
      text = text.substring(prefix.length).trim();
      lowerText = text.toLowerCase();
    }

    text = this._stripContinuationOverlap(text, context);

    const normalized: Suggestion = {
      ...suggestion,
      text,
    };

    const category = suggestion.category || context.highlightedCategory || null;
    if (category) {
      normalized.category = category;
    }

    return normalized;
  }

  private _matchesGrammar(text: string, policy: SlotPolicy): boolean {
    const normalized = text.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (policy.grammar.kind === "adverb_phrase") {
      return /\bly\b/.test(normalized);
    }

    if (policy.grammar.kind === "adjective_phrase") {
      return (
        !/^(a|an|the|his|her|their|its)\b/.test(normalized) &&
        !/\b(is|are|was|were|be|being|been|am)\b/.test(normalized)
      );
    }

    if (
      policy.grammar.kind === "noun_phrase" ||
      policy.grammar.kind === "technical_phrase" ||
      policy.grammar.kind === "time_phrase"
    ) {
      return (
        !/[.!?]$/.test(normalized) &&
        !/\b(is|are|was|were|be|being|been|am)\b/.test(normalized)
      );
    }

    if (policy.grammar.kind === "verb_phrase") {
      return /^(grip(?:ping)?|grasp(?:ing)?|hold(?:ing)?|press(?:ing)?|rest(?:ing)?|steady(?:ing)?|turn(?:ing)?|curl(?:ing)?|clench(?:ing)?|squeez(?:ing)?|tap(?:ping)?|balance(?:ing)?|lean(?:ing)?|reach(?:ing)?|look(?:ing)?|gaze(?:ing)?|track(?:ing)?|tilt(?:ing)?|dolly|pan(?:ning)?|sway(?:ing)?|drift(?:ing)?|walk(?:ing)?|run(?:ning)?|smil(?:e|ing)|nod(?:ding)?|wav(?:e|ing)|stand(?:ing)?|sit(?:ting)?|kneel(?:ing)?)\b/.test(
        normalized,
      );
    }

    return !/[.!?]$/.test(normalized);
  }

  private _contextFit(
    text: string,
    context: EnhancementV2RequestContext,
  ): number {
    const contextTokens = this._tokenSet(
      [
        context.contextBefore,
        context.contextAfter,
        context.spanAnchors,
        context.nearbySpanHints,
      ].join(" "),
    );
    const textTokens = this._tokenSet(text);
    if (textTokens.size === 0) {
      return 0;
    }
    const overlap = [...textTokens].filter((token) => contextTokens.has(token));
    return Math.min(overlap.length / Math.max(textTokens.size, 1), 1);
  }

  private _computeOverlapPenalty(
    text: string,
    context: EnhancementV2RequestContext,
  ): number {
    const afterTokens = (context.contextAfter || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4);
    const textTokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (afterTokens.length === 0 || textTokens.length === 0) {
      return 0;
    }
    const overlap = textTokens.filter((token) =>
      afterTokens.includes(token),
    ).length;
    return Math.min(overlap / Math.max(textTokens.length, 1), 1);
  }

  private _hasLockedCategoryConflict(
    text: string,
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): boolean {
    const targetParent =
      (context.highlightedCategory &&
        getParentCategory(context.highlightedCategory)) ||
      context.highlightedCategory ||
      policy.categoryId;

    return context.lockedSpanCategories.some((category) => {
      const parent = getParentCategory(category) || category;
      if (
        !parent ||
        parent === targetParent ||
        (parent === "camera" && targetParent === "shot") ||
        (parent === "shot" && targetParent === "camera")
      ) {
        return false;
      }
      const pattern = CATEGORY_LOCK_PATTERNS[parent];
      return pattern ? pattern.test(text) : false;
    });
  }

  private _hasBodyPartDrift(
    text: string,
    context: EnhancementV2RequestContext,
  ): boolean {
    const category = context.highlightedCategory || "";
    if (!category.startsWith("subject.appearance")) {
      return false;
    }

    const highlighted = context.highlightedText.toLowerCase();
    const lowerText = text.toLowerCase();

    if (BODY_PART_PATTERNS.face.test(highlighted)) {
      return (
        !BODY_PART_PATTERNS.face.test(lowerText) ||
        BODY_PART_PATTERNS.hand.test(lowerText) ||
        BODY_PART_PATTERNS.hair.test(lowerText) ||
        BODY_PART_PATTERNS.feet.test(lowerText)
      );
    }

    if (BODY_PART_PATTERNS.hand.test(highlighted)) {
      return (
        !BODY_PART_PATTERNS.hand.test(lowerText) ||
        BODY_PART_PATTERNS.face.test(lowerText) ||
        BODY_PART_PATTERNS.hair.test(lowerText) ||
        BODY_PART_PATTERNS.feet.test(lowerText)
      );
    }

    if (BODY_PART_PATTERNS.hair.test(highlighted)) {
      return !BODY_PART_PATTERNS.hair.test(lowerText);
    }

    if (BODY_PART_PATTERNS.feet.test(highlighted)) {
      return !BODY_PART_PATTERNS.feet.test(lowerText);
    }

    if (BODY_PART_PATTERNS.prop.test(highlighted)) {
      return !BODY_PART_PATTERNS.prop.test(lowerText);
    }

    return false;
  }

  private _hasObjectOverlap(
    text: string,
    context: EnhancementV2RequestContext,
  ): boolean {
    const category = context.highlightedCategory || "";
    if (!category.startsWith("action")) {
      return false;
    }

    const lowerText = text.toLowerCase();
    const after = context.contextAfter.toLowerCase();
    return ACTION_OBJECT_TERMS.some(
      (term) => after.includes(term) && lowerText.includes(term),
    );
  }

  private _stripContinuationOverlap(
    text: string,
    context: EnhancementV2RequestContext,
  ): string {
    const category = context.highlightedCategory || "";
    if (!category.startsWith("action")) {
      return text;
    }

    const after = context.contextAfter.trim();
    if (!after) {
      return text;
    }

    const afterTokens = after.toLowerCase().split(/\s+/).slice(0, 6);
    const suggestionTokens = text.toLowerCase().split(/\s+/);
    if (afterTokens.length < 2 || suggestionTokens.length < 2) {
      return text;
    }

    const maxMatch = Math.min(
      5,
      afterTokens.length,
      suggestionTokens.length - 1,
    );
    for (let count = maxMatch; count >= 2; count -= 1) {
      const suggestionTail = suggestionTokens.slice(-count);
      const continuationHead = afterTokens.slice(0, count);
      if (
        suggestionTail.every(
          (token, index) => token === continuationHead[index],
        )
      ) {
        const originalTokens = text.split(/\s+/);
        const stripped = originalTokens
          .slice(0, originalTokens.length - count)
          .join(" ")
          .trim();
        if (stripped) {
          return stripped;
        }
      }
    }

    return text;
  }

  private _tokenSet(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/[\s\-]+/)
        .filter((token) => token && !STOP_WORDS.has(token)),
    );
  }

  private _similarity(a: string, b: string): number {
    const setA = this._tokenSet(a);
    const setB = this._tokenSet(b);
    if (setA.size === 0 || setB.size === 0) {
      return 0;
    }
    const intersection = [...setA].filter((token) => setB.has(token)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
