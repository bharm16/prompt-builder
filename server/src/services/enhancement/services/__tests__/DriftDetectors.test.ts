import { describe, expect, it } from "vitest";
import {
  hasObjectOverlap,
  hasActorDrift,
  hasSubjectClassDrift,
  isMetaphoricalOrAbstract,
  violatesArticleAgreement,
} from "../DriftDetectors";

describe("hasObjectOverlap", () => {
  it("returns false for non-action categories", () => {
    expect(
      hasObjectOverlap("clutching the steering wheel", {
        highlightedCategory: "camera.movement",
      }),
    ).toBe(false);
  });

  it("returns false for action category when no overlap exists", () => {
    expect(
      hasObjectOverlap("swaying gently", {
        highlightedCategory: "action.movement",
        contextAfter: "in the breeze",
      }),
    ).toBe(false);
  });

  it("returns false for action category with empty category string", () => {
    expect(hasObjectOverlap("anything", { highlightedCategory: null })).toBe(
      false,
    );
  });

  it("detects direct overlap: wheel in text matches wheel after context", () => {
    expect(
      hasObjectOverlap("grip the steering wheel", {
        highlightedCategory: "action.physical",
        contextAfter: "the steering wheel tightly",
      }),
    ).toBe(true);
  });

  it("detects hand-bound fullBody action drift", () => {
    expect(
      hasObjectOverlap("leaning forward", {
        highlightedCategory: "action.physical",
        contextBefore: "tiny hands ",
        contextAfter: " on the steering wheel",
      }),
    ).toBe(true);
  });

  it("accepts hand-bound hand-interaction verbs", () => {
    expect(
      hasObjectOverlap("gripping firmly", {
        highlightedCategory: "action.physical",
        contextBefore: "tiny hands ",
        contextAfter: " on the steering wheel",
      }),
    ).toBe(false);
  });

  it("returns false for hand-bound action without hand-interaction and without fullBody", () => {
    // handBoundAction must be false path
    expect(
      hasObjectOverlap("staring out", {
        highlightedCategory: "action.physical",
        contextAfter: "toward the horizon",
      }),
    ).toBe(false);
  });

  it("rejects non-hand verb for hand-bound action (default false path)", () => {
    // handBound + no fullBody match + not hand-interaction → true via !handInteraction
    expect(
      hasObjectOverlap("hovering", {
        highlightedCategory: "action.physical",
        contextBefore: "tiny hands ",
        contextAfter: " near the dashboard",
      }),
    ).toBe(true);
  });

  it("handles action category with no context fields at all", () => {
    expect(
      hasObjectOverlap("gripping", { highlightedCategory: "action.physical" }),
    ).toBe(false);
  });
});

describe("hasActorDrift", () => {
  it("returns false for non-action categories", () => {
    expect(
      hasActorDrift("grinning", { highlightedCategory: "camera.movement" }),
    ).toBe(false);
  });

  it("returns false when no environment-motion context", () => {
    expect(
      hasActorDrift("grinning widely", {
        highlightedCategory: "action.physical",
        contextBefore: "the car drives",
      }),
    ).toBe(false);
  });

  it("detects human-body-action drift in environment-motion context", () => {
    expect(
      hasActorDrift("grinning widely", {
        highlightedCategory: "action.movement",
        contextBefore: "branches sway and",
        contextAfter: "trees move",
      }),
    ).toBe(true);
  });

  it("detects human-subject drift in environment-motion context", () => {
    expect(
      hasActorDrift("the baby reaches", {
        highlightedCategory: "action.movement",
        contextBefore: "leaves rustle and",
      }),
    ).toBe(true);
  });

  it("accepts environment-motion replacement in environment-motion context", () => {
    expect(
      hasActorDrift("branches sway in the wind", {
        highlightedCategory: "action.movement",
        contextBefore: "trees outside and",
      }),
    ).toBe(false);
  });

  it("handles missing highlightedCategory and context fields", () => {
    expect(hasActorDrift("anything", {})).toBe(false);
  });

  it("handles action category with no context fields populated", () => {
    expect(
      hasActorDrift("grinning widely", {
        highlightedCategory: "action.movement",
      }),
    ).toBe(false);
  });
});

describe("hasSubjectClassDrift", () => {
  it("returns false for non-subject categories", () => {
    expect(
      hasSubjectClassDrift("puppy with floppy ears", {
        highlightedCategory: "camera.movement",
      }),
    ).toBe(false);
  });

  it("returns false without human identity context", () => {
    expect(
      hasSubjectClassDrift("puppy with floppy ears", {
        highlightedCategory: "subject.identity",
        highlightedText: "a bird",
      }),
    ).toBe(false);
  });

  it("detects non-human identity drift in human context", () => {
    expect(
      hasSubjectClassDrift("curious puppy", {
        highlightedCategory: "subject.identity",
        highlightedText: "a playful baby",
      }),
    ).toBe(true);
  });

  it("detects fantasy/role-shift drift in human context", () => {
    expect(
      hasSubjectClassDrift("cartoon mascot", {
        highlightedCategory: "subject.identity",
        highlightedText: "playful baby",
      }),
    ).toBe(true);
  });

  it("accepts same-class replacement", () => {
    expect(
      hasSubjectClassDrift("giggling toddler", {
        highlightedCategory: "subject.identity",
        highlightedText: "playful baby",
      }),
    ).toBe(false);
  });

  it("handles missing highlightedCategory and context fields", () => {
    expect(hasSubjectClassDrift("anything", {})).toBe(false);
  });

  it("handles subject category with no context fields populated", () => {
    expect(
      hasSubjectClassDrift("anything", {
        highlightedCategory: "subject.appearance",
      }),
    ).toBe(false);
  });
});

describe("isMetaphoricalOrAbstract", () => {
  it("returns false for non-timeofday categories", () => {
    expect(
      isMetaphoricalOrAbstract("ethereal dream", {
        highlightedCategory: "lighting.quality",
      }),
    ).toBe(false);
  });

  it("detects abstract-visual terms for lighting.timeofday", () => {
    expect(
      isMetaphoricalOrAbstract("ethereal hush of dawn", {
        highlightedCategory: "lighting.timeofday",
      }),
    ).toBe(true);
  });

  it("accepts concrete time-of-day terms", () => {
    expect(
      isMetaphoricalOrAbstract("bright afternoon sun", {
        highlightedCategory: "lighting.timeofday",
      }),
    ).toBe(false);
  });

  it("handles missing highlightedCategory", () => {
    expect(isMetaphoricalOrAbstract("anything", {})).toBe(false);
  });
});

describe("violatesArticleAgreement", () => {
  it("returns false when no trailing article in contextBefore", () => {
    expect(
      violatesArticleAgreement("apple", { contextBefore: "Look at the" }),
    ).toBe(false);
  });

  it("returns false when contextBefore is missing entirely", () => {
    expect(violatesArticleAgreement("apple", {})).toBe(false);
  });

  it("flags possessive nouns after any article", () => {
    expect(
      violatesArticleAgreement("toddler's face", { contextBefore: "a " }),
    ).toBe(true);
  });

  it("flags possessive pronouns after any article", () => {
    expect(
      violatesArticleAgreement("his own reflection", { contextBefore: "a " }),
    ).toBe(true);
  });

  it("returns false when replacement has no leading word", () => {
    // a word character is required; punctuation-only text returns false via !firstWord
    expect(violatesArticleAgreement("!!!", { contextBefore: "a " })).toBe(
      false,
    );
  });

  it('flags vowel-starting word after "a"', () => {
    expect(violatesArticleAgreement("apple", { contextBefore: "a " })).toBe(
      true,
    );
  });

  it('flags silent-h vowel-sound word after "a"', () => {
    expect(
      violatesArticleAgreement("honest moment", { contextBefore: "a " }),
    ).toBe(true);
  });

  it('accepts consonant-starting word after "a"', () => {
    expect(violatesArticleAgreement("baby", { contextBefore: "a " })).toBe(
      false,
    );
  });

  it('flags consonant-starting word after "an"', () => {
    expect(violatesArticleAgreement("baby", { contextBefore: "an " })).toBe(
      true,
    );
  });

  it('flags "use" / "uni-" / "one" consonant-sound words after "an"', () => {
    expect(
      violatesArticleAgreement("unique moment", { contextBefore: "an " }),
    ).toBe(true);
    expect(violatesArticleAgreement("use case", { contextBefore: "an " })).toBe(
      true,
    );
    expect(
      violatesArticleAgreement("one-time event", { contextBefore: "an " }),
    ).toBe(true);
  });

  it('accepts vowel-starting word after "an"', () => {
    expect(violatesArticleAgreement("apple", { contextBefore: "an " })).toBe(
      false,
    );
  });
});
