import { getParentCategory } from "@shared/taxonomy";
import type { Suggestion, VideoService } from "../services/types.js";
import type {
  CandidateEvaluation,
  EnhancementV2RequestContext,
  SemanticFamily,
  SlotPolicy,
} from "./types.js";

/**
 * Map a SemanticFamily name to its corresponding taxonomy category id.
 *
 * Explicit per-family mapping rather than mechanical `_ → .` substitution:
 * 5 of the 24 SemanticFamily values map to camelCase taxonomy ids (e.g.
 * `lighting_time_of_day` → `lighting.timeOfDay`, not `lighting.time.of.day`),
 * which a naive split/join would silently mangle and cause every required/
 * forbidden check on those slots to no-op.
 *
 * Returns null for families that have no direct taxonomy equivalent
 * (`lighting_direction`, `visual_abstract`) — those are structural blind
 * spots and the corresponding gate becomes a no-op for that family.
 */
const FAMILY_TO_CATEGORY_ID: Record<SemanticFamily, string | null> = {
  action: "action",
  audio: "audio",
  camera_angle: "camera.angle",
  camera_focus: "camera.focus",
  camera_lens: "camera.lens",
  camera_movement: "camera.movement",
  environment_context: "environment.context",
  environment_location: "environment.location",
  environment_weather: "environment.weather",
  lighting_direction: null,
  lighting_quality: "lighting.quality",
  lighting_source: "lighting.source",
  lighting_time_of_day: "lighting.timeOfDay",
  shot_type: "shot.type",
  style_aesthetic: "style.aesthetic",
  style_color_grade: "style.colorGrade",
  style_film_stock: "style.filmStock",
  subject_appearance: "subject.appearance",
  subject_identity: "subject.identity",
  technical_aspect_ratio: "technical.aspectRatio",
  technical_duration: "technical.duration",
  technical_frame_rate: "technical.frameRate",
  technical_resolution: "technical.resolution",
  visual_abstract: null,
};

function familyToCategoryId(family: SemanticFamily): string | null {
  return FAMILY_TO_CATEGORY_ID[family] ?? null;
}

/**
 * Structural check: does the candidate's self-classified category fall under
 * (or equal, or include) any of the required policy family categories?
 *
 * Accepted relationships (matches isCategoryForbidden, kept symmetric so
 * intra-parent siblings can't simultaneously satisfy one slot and escape
 * the forbidden gate of a sibling slot):
 *
 * - Exact match: candidate.category === required category
 * - Parent match: candidate.category is the parent of required category
 *   (e.g. candidate "subject" satisfies required "subject.identity")
 * - Child match: candidate.category is a child of required category
 *   (e.g. candidate "subject.identity" satisfies required "subject")
 *
 * Intra-parent siblings do NOT match (e.g. candidate "technical.frameRate"
 * does NOT satisfy required "technical_aspect_ratio" just because both
 * share a `technical` parent). Slot specificity is preserved.
 *
 * Returns true when there are no enforceable required families (no taxonomy
 * mapping available) — those policies fall through to other gates.
 */
function isCategoryRequiredMatch(
  candidateCategory: string | undefined,
  requiredFamilies: readonly SemanticFamily[],
): boolean {
  if (requiredFamilies.length === 0) return true;
  if (!candidateCategory) return false;

  const candidate = candidateCategory.toLowerCase();
  const candidateParent = getParentCategory(candidate);

  let anyEnforceable = false;
  for (const family of requiredFamilies) {
    const requiredId = familyToCategoryId(family);
    if (!requiredId) continue; // no structural mapping — skip this family
    anyEnforceable = true;
    const required = requiredId.toLowerCase();
    if (candidate === required) return true;
    const requiredParent = getParentCategory(required);
    if (candidateParent && candidateParent === required) return true;
    if (requiredParent && requiredParent === candidate) return true;
  }
  // No enforceable required families (all map to null) → fall through to
  // other gates rather than reject. Otherwise, at least one was checkable
  // and none matched → reject.
  return !anyEnforceable;
}

/**
 * Structural check: does the candidate's category match any forbidden family?
 * Same parent/child semantics as isCategoryRequiredMatch but inverted intent.
 */
function isCategoryForbidden(
  candidateCategory: string | undefined,
  forbiddenFamilies: readonly SemanticFamily[],
): boolean {
  if (!candidateCategory || forbiddenFamilies.length === 0) return false;
  const candidate = candidateCategory.toLowerCase();
  const candidateParent = getParentCategory(candidate);

  for (const family of forbiddenFamilies) {
    const forbiddenId = familyToCategoryId(family);
    if (!forbiddenId) continue;
    const forbidden = forbiddenId.toLowerCase();
    if (candidate === forbidden) return true;
    const forbiddenParent = getParentCategory(forbidden);
    if (candidateParent && candidateParent === forbidden) return true;
    if (forbiddenParent && forbiddenParent === candidate) return true;
  }
  return false;
}

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

/**
 * Map an LLM-assigned category id to the grammar kind that fits it.
 * Pure taxonomy lookup — replaces the prior verb-stem / article / "is/are"
 * regex gates with structural inference.
 *
 * Returns null when the category provides no grammar signal (unknown or
 * missing) — the caller should fall through to lenient acceptance rather
 * than reject for a structural blind spot.
 */
type InferredGrammarKind =
  | "verb_phrase"
  | "noun_phrase"
  | "technical_phrase"
  | "adjective_phrase"
  | "time_phrase"
  | "freeform";

/**
 * Map an LLM-assigned category id to the grammar kind that fits it. Uses
 * full-category-id lookup (so `lighting.source` → `technical_phrase` while
 * `lighting.quality` → `adjective_phrase`), with parent fallback for
 * categories not explicitly enumerated. Returns null when no grammar
 * inference is possible — caller falls through to lenient acceptance.
 */
function inferGrammarKindFromCategory(
  category: string | undefined,
): InferredGrammarKind | null {
  if (!category) return null;
  const cat = category.toLowerCase();

  switch (cat) {
    case "lighting.timeofday":
      return "time_phrase";
    case "lighting.quality":
    case "lighting.colortemp":
    case "style.colorgrade":
      return "adjective_phrase";
    case "subject.identity":
    case "subject.appearance":
    case "subject.wardrobe":
    case "subject.emotion":
    case "environment.location":
    case "environment.context":
      return "noun_phrase";
    case "action":
    case "action.movement":
    case "action.gesture":
    case "action.state":
      return "verb_phrase";
    case "shot":
    case "shot.type":
    case "camera.angle":
    case "camera.movement":
    case "camera.lens":
    case "camera.focus":
    case "lighting.source":
    case "style.filmstock":
    case "technical.aspectratio":
    case "technical.framerate":
    case "technical.resolution":
    case "technical.duration":
      return "technical_phrase";
    case "subject":
    case "environment":
    case "environment.weather":
    case "style":
    case "style.aesthetic":
    case "audio":
      return "freeform";
  }

  const parent = getParentCategory(cat);
  switch (parent) {
    case "action":
      return "verb_phrase";
    case "subject":
    case "environment":
      return "noun_phrase";
    case "shot":
    case "camera":
    case "technical":
    case "audio":
      return "technical_phrase";
    default:
      return null;
  }
}

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
  constructor(private readonly videoPromptService: VideoService) {}

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

    if (text.includes("\r") || text.includes("\n")) {
      reasons.push("multiline");
    }

    const wordCount = this.videoPromptService.countWords(text);
    if (
      wordCount < policy.grammar.minWords ||
      wordCount > policy.grammar.maxWords
    ) {
      reasons.push("word_bounds");
    }

    if (!this._matchesGrammar(text, policy, normalizedSuggestion.category)) {
      reasons.push("grammar");
    }

    const requiredMatch = isCategoryRequiredMatch(
      normalizedSuggestion.category,
      policy.requiredFamilies,
    );
    if (policy.requiredFamilies.length > 0 && !requiredMatch) {
      reasons.push("family_miss");
    }

    if (
      isCategoryForbidden(
        normalizedSuggestion.category,
        policy.forbiddenFamilies,
      )
    ) {
      reasons.push("forbidden_family");
    }

    if (
      this._hasLockedCategoryConflict(
        normalizedSuggestion.category,
        context,
        policy,
      )
    ) {
      reasons.push("locked_conflict");
    }

    const familyFit =
      policy.requiredFamilies.length === 0 ? 1 : requiredMatch ? 1 : 0;
    const contextFit = this._contextFit(text, context);
    const literalness = 1;
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

  /**
   * Grammar gate (structural — no regex).
   *
   * Universal rule: reject text ending in sentence-terminator punctuation
   * (`.`, `!`, `?`) — those are full sentences, not phrase fragments.
   *
   * For typed grammar policies, trust the LLM's self-classified `category`
   * field. If the candidate's category lives under a parent that maps to
   * the policy's required grammar kind (e.g. `action.*` → `verb_phrase`),
   * accept. Mismatched categories reject. Missing/unmapped categories fall
   * through to acceptance — other gates (family/forbidden/word-bounds) catch
   * structural drift via taxonomy, not via grammar pattern matching.
   *
   * `freeform` policies (subject/action/environment/style at parent level)
   * accept any non-sentence text.
   */
  private _matchesGrammar(
    text: string,
    policy: SlotPolicy,
    category: string | undefined,
  ): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const last = trimmed.charAt(trimmed.length - 1);
    if (last === "." || last === "!" || last === "?") return false;

    if (policy.grammar.kind === "freeform") return true;

    const inferred = inferGrammarKindFromCategory(category);
    if (!inferred) return true;

    if (policy.grammar.kind === "time_phrase") {
      return category?.toLowerCase() === "lighting.timeofday";
    }

    return inferred === policy.grammar.kind;
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

  /**
   * Locked-category conflict (structural — no regex, no wordlists).
   *
   * Detects when the candidate's self-declared category falls into a
   * locked-span category whose parent differs from the slot we're filling.
   * Example: while filling a `subject` slot with `camera` locked, a
   * candidate that claims its category is `camera.movement` is a conflict.
   *
   * camera ↔ shot are treated as compatible (cinematography continuum)
   * to match prior behavior.
   *
   * If the LLM didn't self-classify (no candidate.category), we cannot
   * detect drift structurally and lenient-pass — other gates handle it.
   */
  private _hasLockedCategoryConflict(
    candidateCategory: string | undefined,
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): boolean {
    if (!candidateCategory) return false;
    const candidateParent =
      getParentCategory(candidateCategory) || candidateCategory;
    const targetParent =
      (context.highlightedCategory &&
        getParentCategory(context.highlightedCategory)) ||
      context.highlightedCategory ||
      policy.categoryId;

    return context.lockedSpanCategories.some((locked) => {
      const lockedParent = getParentCategory(locked) || locked;
      if (
        !lockedParent ||
        lockedParent === targetParent ||
        (lockedParent === "camera" && targetParent === "shot") ||
        (lockedParent === "shot" && targetParent === "camera")
      ) {
        return false;
      }
      return candidateParent === lockedParent;
    });
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
