import * as patterns from "./ValidationPatterns.js";

export type SubjectAppearanceSubRole =
  | "face_detail"
  | "hand_detail"
  | "hair_detail"
  | "feet_detail"
  | "prop_detail"
  | null;

export interface SubjectAppearanceContext {
  highlightedText?: string;
  highlightedCategory?: string | null;
}

function normalizeCategoryKey(category: string): string {
  return category.toLowerCase().replace(/[_-]/g, "");
}

export function detectSubjectAppearanceSubRole(
  context: SubjectAppearanceContext,
): SubjectAppearanceSubRole {
  const category = normalizeCategoryKey(context.highlightedCategory || "");
  if (!category.startsWith("subject.")) {
    return null;
  }

  const highlighted = (context.highlightedText || "").toLowerCase();
  if (patterns.faceCueTerms.test(highlighted)) return "face_detail";
  if (patterns.handCueTerms.test(highlighted)) return "hand_detail";
  if (patterns.hairCueTerms.test(highlighted)) return "hair_detail";
  if (patterns.feetCueTerms.test(highlighted)) return "feet_detail";
  if (patterns.propCueTerms.test(highlighted)) return "prop_detail";
  return null;
}

export function hasBodyPartSubRoleDrift(
  text: string,
  context: SubjectAppearanceContext,
): boolean {
  const subRole = detectSubjectAppearanceSubRole(context);
  if (!subRole) {
    return false;
  }

  const lowerText = text.toLowerCase();
  if (subRole === "face_detail") {
    return (
      !patterns.faceCueTerms.test(lowerText) ||
      patterns.handCueTerms.test(lowerText) ||
      patterns.hairCueTerms.test(lowerText) ||
      patterns.feetCueTerms.test(lowerText) ||
      patterns.propCueTerms.test(lowerText) ||
      /\b(gripping|reaching|playing|resting|touching|catching)\b/i.test(
        lowerText,
      )
    );
  }

  if (subRole === "hand_detail") {
    return (
      !patterns.handCueTerms.test(lowerText) ||
      patterns.faceCueTerms.test(lowerText) ||
      patterns.hairCueTerms.test(lowerText) ||
      patterns.feetCueTerms.test(lowerText) ||
      /\b(sock|toy|stroller)\b/i.test(lowerText)
    );
  }

  if (subRole === "hair_detail") {
    return !patterns.hairCueTerms.test(lowerText);
  }

  if (subRole === "feet_detail") {
    return !patterns.feetCueTerms.test(lowerText);
  }

  if (subRole === "prop_detail") {
    return (
      !patterns.propCueTerms.test(lowerText) ||
      patterns.faceCueTerms.test(lowerText) ||
      patterns.handCueTerms.test(lowerText)
    );
  }

  return false;
}
