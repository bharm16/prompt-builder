import * as patterns from "./ValidationPatterns.js";

export interface DriftContext {
  highlightedText?: string;
  highlightedCategory?: string | null;
  contextBefore?: string;
  contextAfter?: string;
  spanAnchors?: string;
  nearbySpanHints?: string;
}

const overlappingObjectTerms = [
  "steering wheel",
  "wheel",
  "dashboard",
  "window",
  "glass",
  "door",
  "toy",
];

export function hasObjectOverlap(text: string, context: DriftContext): boolean {
  const category = patterns.normalizeCategoryKey(
    context.highlightedCategory || "",
  );
  if (!category.startsWith("action")) {
    return false;
  }

  const after = (context.contextAfter || "").toLowerCase();
  const lowerText = text.toLowerCase();

  if (
    overlappingObjectTerms.some(
      (term) => after.includes(term) && lowerText.includes(term),
    )
  ) {
    return true;
  }

  const localContext = [
    context.highlightedText || "",
    context.contextBefore || "",
    context.contextAfter || "",
    context.spanAnchors || "",
    context.nearbySpanHints || "",
  ]
    .join(" ")
    .toLowerCase();

  const handBoundAction =
    patterns.handCueTerms.test(localContext) &&
    overlappingObjectTerms.some((term) => localContext.includes(term));
  if (!handBoundAction) {
    return false;
  }

  if (patterns.fullBodyActionTerms.test(lowerText)) {
    return true;
  }

  return !patterns.handInteractionTerms.test(lowerText);
}

export function hasActorDrift(text: string, context: DriftContext): boolean {
  const category = patterns.normalizeCategoryKey(
    context.highlightedCategory || "",
  );
  if (!category.startsWith("action")) {
    return false;
  }

  const localContext = [
    context.contextBefore || "",
    context.contextAfter || "",
    context.spanAnchors || "",
    context.nearbySpanHints || "",
  ]
    .join(" ")
    .toLowerCase();

  if (!patterns.environmentMotionSubjectTerms.test(localContext)) {
    return false;
  }

  return (
    patterns.humanBodyActionTerms.test(text.toLowerCase()) ||
    patterns.humanSubjectTerms.test(text.toLowerCase())
  );
}

export function hasSubjectClassDrift(
  text: string,
  context: DriftContext,
): boolean {
  const category = patterns.normalizeCategoryKey(
    context.highlightedCategory || "",
  );
  if (!category.startsWith("subject.")) {
    return false;
  }

  const localContext = [
    context.highlightedText || "",
    context.contextBefore || "",
    context.contextAfter || "",
    context.spanAnchors || "",
    context.nearbySpanHints || "",
  ]
    .join(" ")
    .toLowerCase();

  const hasHumanIdentityContext = patterns.humanSubjectTerms.test(localContext);
  if (!hasHumanIdentityContext) {
    return false;
  }

  const lowerText = text.toLowerCase();
  return (
    patterns.nonHumanIdentityTerms.test(lowerText) ||
    patterns.fantasyOrRoleShiftTerms.test(lowerText)
  );
}

export function isMetaphoricalOrAbstract(
  text: string,
  context: DriftContext,
): boolean {
  const category = patterns.normalizeCategoryKey(
    context.highlightedCategory || "",
  );
  if (category === "lighting.timeofday") {
    return patterns.abstractVisualTerms.test(text.toLowerCase());
  }
  return false;
}

export function violatesArticleAgreement(
  text: string,
  context: DriftContext,
): boolean {
  const prefix = (context.contextBefore || "").trimEnd();
  const articleMatch = prefix.match(/\b(a|an)\s*$/i);
  if (!articleMatch) {
    return false;
  }

  const lowerText = text.toLowerCase();
  if (
    /^[a-z]+['’]s\b/i.test(text) ||
    /^(his|her|their|its)\b/i.test(lowerText)
  ) {
    return true;
  }

  const firstWord = lowerText.match(/^[a-z]+/)?.[0];
  if (!firstWord) {
    return false;
  }

  const article = articleMatch[1]!.toLowerCase();
  const vowelSound =
    /^[aeiou]/.test(firstWord) || /^(honest|hour|heir|honor)/.test(firstWord);
  const consonantSound =
    /^[^aeiou]/.test(firstWord) ||
    /^(uni([^n]|$)|use|euro|one|ubiq)/.test(firstWord);

  if (article === "a" && vowelSound) {
    return true;
  }

  if (article === "an" && consonantSound) {
    return true;
  }

  return false;
}
