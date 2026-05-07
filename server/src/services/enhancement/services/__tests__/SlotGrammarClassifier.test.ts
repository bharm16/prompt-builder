import { describe, expect, it } from "vitest";
import {
  classifySlotGrammarProfile,
  getGrammarProfileRejectReason,
} from "../SlotGrammarClassifier";

describe("classifySlotGrammarProfile", () => {
  it("returns noun_phrase_after_article when contextBefore ends with an article", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "subject.identity",
        contextBefore: "a ",
      }),
    ).toBe("noun_phrase_after_article");
  });

  it("handles 'an' and 'the' articles too", () => {
    expect(classifySlotGrammarProfile({ contextBefore: "an " })).toBe(
      "noun_phrase_after_article",
    );
    expect(classifySlotGrammarProfile({ contextBefore: "the " })).toBe(
      "noun_phrase_after_article",
    );
  });

  it("returns verb_phrase_before_object for action categories", () => {
    expect(
      classifySlotGrammarProfile({ highlightedCategory: "action.physical" }),
    ).toBe("verb_phrase_before_object");
  });

  it("returns adverb_modifier when highlighted ends in 'ly'", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedText: "gently",
        highlightedCategory: "lighting.quality",
      }),
    ).toBe("adverb_modifier");
  });

  it("returns adverb_modifier via 'ly'-suffix shortcut", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "lighting.source",
        highlightedText: "softly",
        contextBefore: "sunlight streams",
        contextAfter: "through the window",
      }),
    ).toBe("adverb_modifier");
  });

  it("returns adverb_modifier via technical-verb + preposition pattern (no 'ly' suffix)", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "lighting.source",
        highlightedText: "soft",
        contextBefore: "sunlight streams",
        contextAfter: "through the window",
      }),
    ).toBe("adverb_modifier");
  });

  it("returns adjective_modifier for lighting.quality without adverb cue", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "lighting.quality",
        highlightedText: "warm",
        contextBefore: "a ",
        contextAfter: " diffuse wash",
      }),
    ).toBe("noun_phrase_after_article");
  });

  it("returns adjective_modifier when contextAfter starts with punctuation", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "lighting.source",
        highlightedText: "warm",
        contextAfter: ", casting soft shadows",
      }),
    ).toBe("adjective_modifier");
  });

  it("returns adjective_modifier when contextBefore is empty and contextAfter has content", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "camera.angle",
        highlightedText: "wide",
        contextAfter: "shot of the scene",
      }),
    ).toBe("adjective_modifier");
  });

  it("returns noun_phrase_before_object for subject slots followed by action verbs", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "subject.appearance",
        highlightedText: "the wheel",
        contextBefore: "clutching ",
        contextAfter: "gripping tightly",
      }),
    ).toBe("noun_phrase_before_object");
  });

  it("returns noun_phrase_before_object for environment.context slots followed by action verbs", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "environment.context",
        highlightedText: "hands",
        contextBefore: "with two ",
        contextAfter: "holding the bar",
      }),
    ).toBe("noun_phrase_before_object");
  });

  it("returns bare_technical_phrase as default fallback", () => {
    expect(
      classifySlotGrammarProfile({
        highlightedCategory: "technical.framerate",
        highlightedText: "24fps",
      }),
    ).toBe("bare_technical_phrase");
  });

  it("handles empty context with no category", () => {
    expect(classifySlotGrammarProfile({})).toBe("bare_technical_phrase");
  });
});

describe("getGrammarProfileRejectReason", () => {
  describe("adverb_modifier", () => {
    it("accepts 'ly'-suffixed adverbs matching the prefix whitelist", () => {
      expect(
        getGrammarProfileRejectReason(
          "warmly",
          "lighting.quality",
          "adverb_modifier",
        ),
      ).toBe(null);
    });

    it("accepts softly/gentle/brightly prefix patterns", () => {
      expect(
        getGrammarProfileRejectReason(
          "softly",
          "lighting.quality",
          "adverb_modifier",
        ),
      ).toBe(null);
    });

    it("rejects non-adverbial text", () => {
      expect(
        getGrammarProfileRejectReason(
          "warm golden light",
          "lighting.quality",
          "adverb_modifier",
        ),
      ).toBe("slot_form");
    });

    it("rejects empty strings", () => {
      expect(
        getGrammarProfileRejectReason(
          "   ",
          "lighting.quality",
          "adverb_modifier",
        ),
      ).toBe("slot_form");
    });

    it("rejects adverbs with more than 3 words", () => {
      expect(
        getGrammarProfileRejectReason(
          "very gently and slowly",
          "lighting.quality",
          "adverb_modifier",
        ),
      ).toBe("slot_form");
    });
  });

  describe("adjective_modifier", () => {
    it("accepts plain adjective phrases", () => {
      expect(
        getGrammarProfileRejectReason(
          "warm golden",
          "lighting.quality",
          "adjective_modifier",
        ),
      ).toBe(null);
    });

    it("rejects phrases starting with articles", () => {
      expect(
        getGrammarProfileRejectReason(
          "a warm glow",
          "lighting.quality",
          "adjective_modifier",
        ),
      ).toBe("slot_form");
    });

    it("rejects phrases with prepositions/conjunctions", () => {
      expect(
        getGrammarProfileRejectReason(
          "warm with a hint of amber",
          "lighting.quality",
          "adjective_modifier",
        ),
      ).toBe("slot_form");
    });

    it("rejects style.aesthetic noun-cue terms (film/palette/grade)", () => {
      expect(
        getGrammarProfileRejectReason(
          "technicolor palette",
          "style.aesthetic",
          "adjective_modifier",
        ),
      ).toBe("slot_form");
    });

    it("rejects phrases with linking verbs", () => {
      expect(
        getGrammarProfileRejectReason(
          "is warm",
          "lighting.quality",
          "adjective_modifier",
        ),
      ).toBe("slot_form");
    });

    it("rejects empty strings", () => {
      expect(
        getGrammarProfileRejectReason(
          "  ",
          "lighting.quality",
          "adjective_modifier",
        ),
      ).toBe("slot_form");
    });
  });

  describe("noun_phrase_after_article", () => {
    it("accepts noun phrases", () => {
      expect(
        getGrammarProfileRejectReason(
          "playful baby",
          "subject.identity",
          "noun_phrase_after_article",
        ),
      ).toBe(null);
    });

    it("rejects verb-start gerunds", () => {
      expect(
        getGrammarProfileRejectReason(
          "gripping the wheel",
          "subject.identity",
          "noun_phrase_after_article",
        ),
      ).toBe("slot_form");
    });

    it("rejects linking-verb phrases", () => {
      expect(
        getGrammarProfileRejectReason(
          "is a puppy",
          "subject.identity",
          "noun_phrase_after_article",
        ),
      ).toBe("slot_form");
    });

    it("rejects empty strings", () => {
      expect(
        getGrammarProfileRejectReason(
          "   ",
          "subject.identity",
          "noun_phrase_after_article",
        ),
      ).toBe("slot_form");
    });
  });

  describe("noun_phrase_before_object", () => {
    it("accepts noun phrases", () => {
      expect(
        getGrammarProfileRejectReason(
          "tiny hands",
          "subject.appearance",
          "noun_phrase_before_object",
        ),
      ).toBe(null);
    });
  });

  describe("verb_phrase_before_object", () => {
    it("accepts action verbs", () => {
      expect(
        getGrammarProfileRejectReason(
          "gripping firmly",
          "action.physical",
          "verb_phrase_before_object",
        ),
      ).toBe(null);
    });

    it("rejects article-starting phrases", () => {
      expect(
        getGrammarProfileRejectReason(
          "a hand",
          "action.physical",
          "verb_phrase_before_object",
        ),
      ).toBe("slot_form");
    });

    it("rejects non-action-verb phrases", () => {
      expect(
        getGrammarProfileRejectReason(
          "warm lighting",
          "action.physical",
          "verb_phrase_before_object",
        ),
      ).toBe("slot_form");
    });

    it("rejects empty strings", () => {
      expect(
        getGrammarProfileRejectReason(
          " ",
          "action.physical",
          "verb_phrase_before_object",
        ),
      ).toBe("slot_form");
    });
  });

  describe("bare_technical_phrase", () => {
    it("returns null (no form restriction)", () => {
      expect(
        getGrammarProfileRejectReason(
          "24fps 4k",
          "technical.framerate",
          "bare_technical_phrase",
        ),
      ).toBe(null);
    });
  });
});
