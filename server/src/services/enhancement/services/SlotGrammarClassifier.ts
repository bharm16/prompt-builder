import * as patterns from "./ValidationPatterns.js";

export type SlotGrammarProfile =
  | "adjective_modifier"
  | "adverb_modifier"
  | "noun_phrase_after_article"
  | "noun_phrase_before_object"
  | "verb_phrase_before_object"
  | "bare_technical_phrase";

export interface SlotGrammarContext {
  highlightedText?: string;
  highlightedCategory?: string | null;
  contextBefore?: string;
  contextAfter?: string;
}

function normalizeCategoryKey(category: string): string {
  return category.toLowerCase().replace(/[_-]/g, "");
}

export function classifySlotGrammarProfile(
  context: SlotGrammarContext,
): SlotGrammarProfile {
  const category = normalizeCategoryKey(context.highlightedCategory || "");
  const before = (context.contextBefore || "").trimEnd().toLowerCase();
  const after = (context.contextAfter || "").trimStart().toLowerCase();
  const highlighted = (context.highlightedText || "").trim().toLowerCase();

  if (/\b(a|an|the)\s*$/.test(before)) {
    return "noun_phrase_after_article";
  }

  if (category.startsWith("action")) {
    return "verb_phrase_before_object";
  }

  if (
    highlighted.endsWith("ly") ||
    (highlighted.split(/\s+/).filter(Boolean).length === 1 &&
      patterns.technicalVerbLeadTerms.test(before) &&
      /^(through|across|into|over|around|beneath|onto|inside|outside)\b/.test(
        after,
      ))
  ) {
    return "adverb_modifier";
  }

  if (
    category === "lighting.quality" ||
    /^[,.;:!?-]/.test(after) ||
    (!before && !!after)
  ) {
    return "adjective_modifier";
  }

  if (
    (category.startsWith("subject.") || category === "environment.context") &&
    /^(gripping|holding|resting|visible|pressed|touching|framed|curled|wrapped)\b/.test(
      after,
    )
  ) {
    return "noun_phrase_before_object";
  }

  return "bare_technical_phrase";
}

export function getGrammarProfileRejectReason(
  text: string,
  category: string,
  slotProfile: SlotGrammarProfile,
): "slot_form" | null {
  if (slotProfile === "adverb_modifier") {
    return looksLikeAdverb(text) ? null : "slot_form";
  }

  if (slotProfile === "adjective_modifier") {
    if (!looksLikeAdjectiveLikePhrase(text, category)) {
      return "slot_form";
    }
    return null;
  }

  if (
    slotProfile === "noun_phrase_after_article" ||
    slotProfile === "noun_phrase_before_object"
  ) {
    return looksLikeNounPhrase(text) ? null : "slot_form";
  }

  if (slotProfile === "verb_phrase_before_object") {
    return looksLikeVerbPhrase(text) ? null : "slot_form";
  }

  return null;
}

function looksLikeAdverb(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  if (normalized.split(/\s+/).length > 3) return false;
  return (
    /\bly\b/.test(normalized) ||
    /^(soft|gentle|bright|warm|dim|faint|bare|even)\w*ly\b/.test(normalized)
  );
}

function looksLikeAdjectiveLikePhrase(text: string, category: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  if (/^(a|an|the|his|her|their|its)\b/.test(normalized)) return false;
  if (/\b(of|with|while|because|that)\b/.test(normalized)) return false;
  if (
    category === "style.aesthetic" &&
    patterns.styleNounCueTerms.test(normalized)
  ) {
    return false;
  }
  if (/\b(is|are|was|were|be|being|been|am)\b/.test(normalized)) return false;
  return true;
}

function looksLikeNounPhrase(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  if (/\b(is|are|was|were|be|being|been|am)\b/.test(normalized)) return false;
  if (
    /^(gripping|holding|resting|turning|leaning|looking|reaching|pressing|curling|squeezing)\b/.test(
      normalized,
    )
  ) {
    return false;
  }
  return true;
}

function looksLikeVerbPhrase(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  if (/^(a|an|the|his|her|their|its)\b/.test(normalized)) return false;
  return /^(grip(?:ping)?|grasp(?:ing)?|hold(?:ing)?|press(?:ing)?|rest(?:ing)?|steady(?:ing)?|turn(?:ing)?|curl(?:ing)?|clench(?:ing)?|squeez(?:ing)?|tap(?:ping)?|balance(?:ing)?|lean(?:ing)?|reach(?:ing)?|look(?:ing)?|gaze(?:ing)?|track(?:ing)?|tilt(?:ing)?|dolly|pan(?:ning)?|sway(?:ing)?|drift(?:ing)?|rustl(?:e|ing)|(?:branches?|trees?|leaves?|grass|waves?|water|clouds?)\s+\w+ing)\b/.test(
    normalized,
  );
}
