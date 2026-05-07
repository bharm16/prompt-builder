import { describe, expect, it } from "vitest";
import {
  detectSubjectAppearanceSubRole,
  hasBodyPartSubRoleDrift,
} from "../SubjectAppearanceClassifier";

describe("detectSubjectAppearanceSubRole", () => {
  it("returns null for non-subject categories", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "camera.movement",
        highlightedText: "face",
      }),
    ).toBe(null);
  });

  it("returns null when category is missing", () => {
    expect(detectSubjectAppearanceSubRole({ highlightedText: "face" })).toBe(
      null,
    );
  });

  it("returns null for subject category with no body-part cue", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.identity",
        highlightedText: "a cheerful toddler",
      }),
    ).toBe(null);
  });

  it("returns null for subject category when highlightedText is missing", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance",
      }),
    ).toBe(null);
  });

  it("detects face_detail from face cue terms", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance",
        highlightedText: "rosy cheeks",
      }),
    ).toBe("face_detail");
  });

  it("detects hand_detail from hand cue terms", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance",
        highlightedText: "plump fingers",
      }),
    ).toBe("hand_detail");
  });

  it("detects hair_detail from hair cue terms", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance",
        highlightedText: "tousled curls",
      }),
    ).toBe("hair_detail");
  });

  it("detects feet_detail from feet cue terms", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance",
        highlightedText: "tiny toes",
      }),
    ).toBe("feet_detail");
  });

  it("detects prop_detail from prop cue terms", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance",
        highlightedText: "steering wheel",
      }),
    ).toBe("prop_detail");
  });

  it("normalizes category casing", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "Subject.Appearance",
        highlightedText: "eyes",
      }),
    ).toBe("face_detail");
  });

  it("strips underscores and hyphens in category normalization", () => {
    expect(
      detectSubjectAppearanceSubRole({
        highlightedCategory: "subject.appearance_detail",
        highlightedText: "eyes",
      }),
    ).toBe("face_detail");
  });
});

describe("hasBodyPartSubRoleDrift", () => {
  it("returns false when no sub-role detected", () => {
    expect(
      hasBodyPartSubRoleDrift("anything", {
        highlightedCategory: "camera.movement",
        highlightedText: "tracking shot",
      }),
    ).toBe(false);
  });

  describe("face_detail", () => {
    const ctx = {
      highlightedCategory: "subject.appearance",
      highlightedText: "rosy cheeks",
    };

    it("accepts face-only replacement", () => {
      expect(hasBodyPartSubRoleDrift("bright eyes", ctx)).toBe(false);
    });

    it("rejects when no face cue at all", () => {
      expect(hasBodyPartSubRoleDrift("warm lighting", ctx)).toBe(true);
    });

    it("rejects cross-body-part drift to hands", () => {
      expect(hasBodyPartSubRoleDrift("hands with cheeks", ctx)).toBe(true);
    });

    it("rejects cross-body-part drift to hair", () => {
      expect(hasBodyPartSubRoleDrift("face with curls", ctx)).toBe(true);
    });

    it("rejects cross-body-part drift to feet", () => {
      expect(hasBodyPartSubRoleDrift("face above toes", ctx)).toBe(true);
    });

    it("rejects cross-body-part drift to props", () => {
      expect(hasBodyPartSubRoleDrift("face near a toy", ctx)).toBe(true);
    });

    it("rejects action-verb language in a face slot", () => {
      expect(hasBodyPartSubRoleDrift("face reaching upward", ctx)).toBe(true);
    });
  });

  describe("hand_detail", () => {
    const ctx = {
      highlightedCategory: "subject.appearance",
      highlightedText: "plump fingers",
    };

    it("accepts hand-only replacement", () => {
      expect(hasBodyPartSubRoleDrift("small chubby hands", ctx)).toBe(false);
    });

    it("rejects when no hand cue", () => {
      expect(hasBodyPartSubRoleDrift("warm lighting", ctx)).toBe(true);
    });

    it("rejects drift to face", () => {
      expect(hasBodyPartSubRoleDrift("hands and cheeks", ctx)).toBe(true);
    });

    it("rejects drift to hair", () => {
      expect(hasBodyPartSubRoleDrift("hands with curls", ctx)).toBe(true);
    });

    it("rejects drift to feet", () => {
      expect(hasBodyPartSubRoleDrift("hands near feet", ctx)).toBe(true);
    });

    it("rejects sock / toy / stroller mentions", () => {
      expect(hasBodyPartSubRoleDrift("hands with socks", ctx)).toBe(true);
      expect(hasBodyPartSubRoleDrift("fingers holding a toy", ctx)).toBe(true);
      expect(hasBodyPartSubRoleDrift("hands gripping the stroller", ctx)).toBe(
        true,
      );
    });
  });

  describe("hair_detail", () => {
    const ctx = {
      highlightedCategory: "subject.appearance",
      highlightedText: "messy braids",
    };

    it("accepts hair replacement", () => {
      expect(hasBodyPartSubRoleDrift("soft curls", ctx)).toBe(false);
    });

    it("rejects when no hair cue", () => {
      expect(hasBodyPartSubRoleDrift("bright cheeks", ctx)).toBe(true);
    });
  });

  describe("feet_detail", () => {
    const ctx = {
      highlightedCategory: "subject.appearance",
      highlightedText: "tiny bare feet",
    };

    it("accepts feet replacement", () => {
      expect(hasBodyPartSubRoleDrift("chubby toes", ctx)).toBe(false);
    });

    it("rejects when no feet cue", () => {
      expect(hasBodyPartSubRoleDrift("bright eyes", ctx)).toBe(true);
    });
  });

  describe("prop_detail", () => {
    const ctx = {
      highlightedCategory: "subject.appearance",
      highlightedText: "steering wheel",
    };

    it("accepts prop-only replacement", () => {
      expect(hasBodyPartSubRoleDrift("worn leather steering wheel", ctx)).toBe(
        false,
      );
    });

    it("rejects when no prop cue", () => {
      expect(hasBodyPartSubRoleDrift("warm lighting", ctx)).toBe(true);
    });

    it("rejects drift to face", () => {
      expect(hasBodyPartSubRoleDrift("wheel framing the cheeks", ctx)).toBe(
        true,
      );
    });

    it("rejects drift to hands", () => {
      expect(hasBodyPartSubRoleDrift("wheel beneath fingers", ctx)).toBe(true);
    });
  });
});
