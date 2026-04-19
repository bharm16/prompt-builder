import * as patterns from "./ValidationPatterns.js";
import {
  classifySlotGrammarProfile,
  getGrammarProfileRejectReason,
  type SlotGrammarContext,
} from "./SlotGrammarClassifier.js";
import type { SuggestionRejectReason } from "./types.js";

export type CategoryDriftContext = SlotGrammarContext;

function normalizeCategoryKey(category: string): string {
  return category.toLowerCase().replace(/[_-]/g, "");
}

export function getCategoryDriftRejectReason(
  text: string,
  context: CategoryDriftContext,
  countWords: (text: string) => number,
): SuggestionRejectReason | null {
  const category = normalizeCategoryKey(context.highlightedCategory || "");
  const lowerText = text.toLowerCase();
  const slotProfile = classifySlotGrammarProfile(context);

  const slotFormReject = getGrammarProfileRejectReason(
    text,
    category,
    slotProfile,
  );
  if (slotFormReject) {
    return slotFormReject;
  }

  if (category === "lighting.quality" && slotProfile === "adverb_modifier") {
    if (
      patterns.cameraTechniqueTerms.test(text) ||
      patterns.cameraFocusTerms.test(text)
    ) {
      return "category_drift";
    }
    const looksLikeSourceClause =
      patterns.lightSourceClauseTerms.test(text) &&
      (countWords(text) >= 4 || patterns.lightingClauseVerbTerms.test(text));
    if (looksLikeSourceClause) {
      return "slot_form";
    }
    return null;
  }

  if (category === "camera.angle") {
    if (
      patterns.cameraMovementTerms.test(text) ||
      patterns.lensApertureTerms.test(text) ||
      patterns.cameraFocusTerms.test(text)
    ) {
      return "category_drift";
    }
    return patterns.cameraAngleTerms.test(text) ? null : "category_drift";
  }

  if (category === "camera.movement") {
    if (
      patterns.lensApertureTerms.test(text) ||
      patterns.cameraFocusTerms.test(text) ||
      patterns.shotFramingTerms.test(text)
    ) {
      return "category_drift";
    }
    return patterns.cameraMovementTerms.test(text) ? null : "category_drift";
  }

  if (category === "camera.focus") {
    if (
      patterns.cameraMovementTerms.test(text) ||
      patterns.lensApertureTerms.test(text) ||
      patterns.shotFramingTerms.test(text)
    ) {
      return "category_drift";
    }
    return patterns.cameraFocusTerms.test(text) ? null : "category_drift";
  }

  if (category === "camera.lens") {
    if (
      patterns.cameraMovementTerms.test(text) ||
      patterns.cameraFocusTerms.test(text) ||
      patterns.shotFramingTerms.test(text)
    ) {
      return "category_drift";
    }
    return patterns.lensApertureTerms.test(text) ? null : "category_drift";
  }

  if (category === "shot.type") {
    const hasShotFraming = patterns.shotFramingTerms.test(text);
    const hasMovementLanguage = patterns.cameraMovementTerms.test(text);
    if (/\b(of|featuring|showing|looking|emphasizing)\b/i.test(text)) {
      return "slot_form";
    }
    if (!hasShotFraming) {
      return "category_drift";
    }
    return hasMovementLanguage ||
      patterns.lensApertureTerms.test(text) ||
      patterns.cameraFocusTerms.test(text)
      ? "category_drift"
      : null;
  }

  const highlightedWordCount = countWords(context.highlightedText || "");
  const suggestionWordCount = countWords(text);
  const isAdjectiveLikeLightingSlot =
    category === "lighting.quality" ||
    (category.startsWith("lighting.") &&
      highlightedWordCount <= 2 &&
      typeof context.contextAfter === "string" &&
      context.contextAfter.trim().startsWith(","));

  if (isAdjectiveLikeLightingSlot && slotProfile !== "adverb_modifier") {
    if (
      patterns.cameraTechniqueTerms.test(text) ||
      patterns.cameraFocusTerms.test(text)
    ) {
      return "category_drift";
    }
    const looksLikeSourceClause =
      patterns.lightSourceClauseTerms.test(text) &&
      (suggestionWordCount >= 4 || patterns.lightingClauseVerbTerms.test(text));
    if (looksLikeSourceClause) {
      return "slot_form";
    }
    if (!patterns.lightingQualityCueTerms.test(text)) {
      return "category_drift";
    }
    if (
      patterns.shadowCueTerms.test(context.highlightedText || "") &&
      !patterns.shadowCueTerms.test(text)
    ) {
      return "coherence_conflict";
    }
  }

  if (category === "lighting.timeofday") {
    if (
      patterns.cameraTechniqueTerms.test(text) ||
      patterns.cameraFocusTerms.test(text) ||
      patterns.lightSourceClauseTerms.test(text) ||
      patterns.lightingClauseVerbTerms.test(text) ||
      patterns.lightingDirectionTerms.test(text)
    ) {
      return "category_drift";
    }
    if (!patterns.timeOfDayTerms.test(text)) {
      return "category_drift";
    }
    if (
      !patterns.canonicalTimeTokens.test(lowerText) ||
      patterns.abstractVisualTerms.test(lowerText)
    ) {
      return "metaphor_or_abstract";
    }
    return null;
  }

  if (category === "lighting.source") {
    if (
      patterns.cameraTechniqueTerms.test(text) ||
      patterns.cameraFocusTerms.test(text)
    ) {
      return "category_drift";
    }
    if (!patterns.lightingQualityCueTerms.test(text)) {
      return "category_drift";
    }
    const hasSourceOrDirection =
      patterns.lightSourceClauseTerms.test(text) ||
      patterns.lightingDirectionTerms.test(text);
    if (!hasSourceOrDirection) {
      return "category_drift";
    }
  }

  if (category === "style.aesthetic") {
    if (
      patterns.cameraTechniqueTerms.test(text) ||
      patterns.cameraMovementTerms.test(text) ||
      patterns.lightSourceClauseTerms.test(text) ||
      patterns.lightingDirectionTerms.test(text)
    ) {
      return "category_drift";
    }
    if (!patterns.styleStrongCueTerms.test(text)) {
      return "category_drift";
    }
  }

  if (category === "environment.location") {
    if (
      patterns.environmentContextTerms.test(text) ||
      patterns.vehicleInteriorTerms.test(text)
    ) {
      return "category_drift";
    }
    return patterns.externalLocationTerms.test(text) ? null : "category_drift";
  }

  if (category === "environment.context") {
    if (patterns.externalLocationTerms.test(text)) {
      return "category_drift";
    }
    return patterns.environmentContextTerms.test(text)
      ? null
      : "category_drift";
  }

  if (category === "environment.weather") {
    const highlighted = (context.highlightedText || "").toLowerCase();
    if (
      patterns.weatherGentleAirTerms.test(highlighted) &&
      patterns.weatherDisruptiveTerms.test(lowerText)
    ) {
      return "coherence_conflict";
    }
  }

  return null;
}
