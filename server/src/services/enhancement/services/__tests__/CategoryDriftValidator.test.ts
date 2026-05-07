import { describe, expect, it } from "vitest";
import { getCategoryDriftRejectReason } from "../CategoryDriftValidator";

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

describe("getCategoryDriftRejectReason", () => {
  describe("grammar form gating (short-circuits before category rules)", () => {
    it("returns slot_form when the grammar profile rejects the text", () => {
      // adjective_modifier path + text starts with article
      expect(
        getCategoryDriftRejectReason(
          "a warm glow",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "warm",
          },
          countWords,
        ),
      ).toBe("slot_form");
    });
  });

  describe("lighting.quality + adverb_modifier (adverb slot)", () => {
    const ctx = {
      highlightedCategory: "lighting.quality",
      highlightedText: "softly",
    };

    it("rejects camera-technique drift in an adverb lighting slot", () => {
      // text must be adverb-shaped to pass the grammar-form gate AND contain a
      // camera-technique term: "warmly tracking" satisfies both.
      expect(
        getCategoryDriftRejectReason("warmly tracking", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects camera-focus drift in an adverb lighting slot", () => {
      expect(
        getCategoryDriftRejectReason("softly bokeh", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects source-clause with clause verbs in an adverb lighting slot", () => {
      // The >=4-word branch of looksLikeSourceClause is unreachable here
      // because the grammar-form gate (looksLikeAdverb) caps text at 3 words.
      // Only the lightingClauseVerbTerms path can be exercised.
      expect(
        getCategoryDriftRejectReason("warmly streaming from", ctx, countWords),
      ).toBe("slot_form");
    });

    it("accepts a plain adverb in the adverb lighting slot", () => {
      expect(getCategoryDriftRejectReason("softly", ctx, countWords)).toBe(
        null,
      );
    });
  });

  describe("camera.angle", () => {
    const ctx = {
      highlightedCategory: "camera.angle",
      highlightedText: "eye level",
    };

    it("rejects camera-movement drift", () => {
      expect(getCategoryDriftRejectReason("dolly shot", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects lens-aperture drift", () => {
      expect(
        getCategoryDriftRejectReason("50mm prime lens", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects camera-focus drift", () => {
      expect(
        getCategoryDriftRejectReason("shallow depth of field", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects unrelated text without camera-angle cue", () => {
      expect(
        getCategoryDriftRejectReason("warm sunlight", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts valid camera-angle phrasing", () => {
      expect(
        getCategoryDriftRejectReason("low-angle view", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("camera.movement", () => {
    const ctx = {
      highlightedCategory: "camera.movement",
      highlightedText: "tracking shot",
    };

    it("rejects lens-aperture drift", () => {
      expect(getCategoryDriftRejectReason("50mm lens", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects camera-focus drift", () => {
      expect(
        getCategoryDriftRejectReason("selective focus", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects shot-framing drift", () => {
      expect(getCategoryDriftRejectReason("wide shot", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects unrelated text", () => {
      expect(
        getCategoryDriftRejectReason("warm sunlight", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts valid camera-movement phrasing", () => {
      expect(
        getCategoryDriftRejectReason("dolly in toward", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("camera.focus", () => {
    const ctx = {
      highlightedCategory: "camera.focus",
      highlightedText: "softly out of focus",
    };

    it("rejects camera-movement drift", () => {
      expect(getCategoryDriftRejectReason("dolly move", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects lens-aperture drift", () => {
      expect(
        getCategoryDriftRejectReason("50mm aperture", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects shot-framing drift", () => {
      expect(
        getCategoryDriftRejectReason("close-up shot", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects unrelated text", () => {
      expect(
        getCategoryDriftRejectReason("warm sunlight", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts valid camera-focus phrasing", () => {
      expect(
        getCategoryDriftRejectReason("deep bokeh separation", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("camera.lens", () => {
    const ctx = {
      highlightedCategory: "camera.lens",
      highlightedText: "50mm lens",
    };

    it("rejects camera-movement drift", () => {
      expect(getCategoryDriftRejectReason("dolly out", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects camera-focus drift", () => {
      expect(
        getCategoryDriftRejectReason("shallow depth of field", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects shot-framing drift", () => {
      expect(getCategoryDriftRejectReason("wide shot", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects unrelated text", () => {
      expect(
        getCategoryDriftRejectReason("warm sunlight", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts valid lens phrasing", () => {
      expect(
        getCategoryDriftRejectReason("anamorphic prime", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("shot.type", () => {
    const ctx = {
      highlightedCategory: "shot.type",
      highlightedText: "medium shot",
    };

    it("rejects explanatory phrasing with 'of / featuring / showing'", () => {
      expect(
        getCategoryDriftRejectReason(
          "close-up shot of the subject",
          ctx,
          countWords,
        ),
      ).toBe("slot_form");
    });

    it("rejects when no shot-framing terms", () => {
      expect(
        getCategoryDriftRejectReason("warm lighting", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects shot-framing mixed with movement drift", () => {
      expect(
        getCategoryDriftRejectReason("dolly close-up", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects shot-framing mixed with lens drift", () => {
      expect(
        getCategoryDriftRejectReason("close-up 50mm", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects shot-framing mixed with focus drift", () => {
      expect(
        getCategoryDriftRejectReason(
          "close-up with shallow focus",
          ctx,
          countWords,
        ),
      ).toBe("category_drift");
    });

    it("accepts clean shot-framing phrasing", () => {
      expect(
        getCategoryDriftRejectReason("extreme close-up", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("adjective-like lighting (lighting.quality as adjective, or lighting.* with short highlight + comma)", () => {
    it("rejects camera-technique drift in adjective lighting slot", () => {
      expect(
        getCategoryDriftRejectReason(
          "handheld tracking",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "warm",
            contextAfter: ", golden glow",
          },
          countWords,
        ),
      ).toBe("category_drift");
    });

    it("rejects camera-focus drift in adjective lighting slot", () => {
      expect(
        getCategoryDriftRejectReason(
          "shallow focus",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "warm",
            contextAfter: ", golden",
          },
          countWords,
        ),
      ).toBe("category_drift");
    });

    it("rejects long source-clause style for adjective slot", () => {
      expect(
        getCategoryDriftRejectReason(
          "warm glow streaming through backlit window",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "warm",
            contextAfter: ", golden",
          },
          countWords,
        ),
      ).toBe("slot_form");
    });

    it("rejects when lighting-quality cue is missing entirely", () => {
      expect(
        getCategoryDriftRejectReason(
          "crisp outline",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "warm",
            contextAfter: ", golden",
          },
          countWords,
        ),
      ).toBe("category_drift");
    });

    it("rejects source-clause via clause-verb short-circuit (<4 words) for adjective slot", () => {
      expect(
        getCategoryDriftRejectReason(
          "warm streaming from",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "warm",
            contextAfter: ", golden",
          },
          countWords,
        ),
      ).toBe("slot_form");
    });

    it("handles adjective-like lighting slot when highlightedText is missing (|| fallback)", () => {
      expect(
        getCategoryDriftRejectReason(
          "warm glow",
          {
            highlightedCategory: "lighting.quality",
            contextAfter: ", golden",
          },
          countWords,
        ),
      ).toBe(null);
    });

    it("flags coherence_conflict when original highlight references shadows but replacement doesn't", () => {
      expect(
        getCategoryDriftRejectReason(
          "warm glow",
          {
            highlightedCategory: "lighting.quality",
            highlightedText: "soft shadows",
            contextAfter: ", golden",
          },
          countWords,
        ),
      ).toBe("coherence_conflict");
    });

    it("triggers lighting.source adjective-like path via short highlight + trailing comma", () => {
      expect(
        getCategoryDriftRejectReason(
          "handheld track",
          {
            highlightedCategory: "lighting.source",
            highlightedText: "warm",
            contextAfter: ", soft glow",
          },
          countWords,
        ),
      ).toBe("category_drift");
    });
  });

  describe("lighting.timeofday", () => {
    const ctx = {
      highlightedCategory: "lighting.timeofday",
      highlightedText: "golden hour",
    };

    it("rejects camera-technique drift", () => {
      expect(
        getCategoryDriftRejectReason("handheld tracking", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects camera-focus drift", () => {
      expect(
        getCategoryDriftRejectReason("shallow focus", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects light-source clause drift", () => {
      expect(
        getCategoryDriftRejectReason("rear window backlight", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects lighting-clause-verb drift", () => {
      expect(
        getCategoryDriftRejectReason("streaming amber light", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects lighting-direction drift", () => {
      expect(
        getCategoryDriftRejectReason("side-lit rim", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects when no time-of-day cue", () => {
      expect(
        getCategoryDriftRejectReason("cheerful ambient", ctx, countWords),
      ).toBe("category_drift");
    });

    it("flags metaphorical/abstract visual terms as metaphor_or_abstract", () => {
      expect(
        getCategoryDriftRejectReason("ethereal hush of dawn", ctx, countWords),
      ).toBe("metaphor_or_abstract");
    });

    it("accepts canonical time-of-day tokens", () => {
      expect(
        getCategoryDriftRejectReason("bright afternoon", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("lighting.source", () => {
    const ctx = {
      highlightedCategory: "lighting.source",
      highlightedText: "key light",
    };

    it("rejects camera-technique drift", () => {
      expect(
        getCategoryDriftRejectReason("handheld tracking", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects camera-focus drift", () => {
      expect(
        getCategoryDriftRejectReason("shallow focus", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects text without lighting-quality cue", () => {
      expect(
        getCategoryDriftRejectReason("crisp outline", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects lighting-quality text without source/direction", () => {
      expect(
        getCategoryDriftRejectReason("warm diffuse glow", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts lighting-quality + source/direction text", () => {
      expect(
        getCategoryDriftRejectReason(
          "rim light from the window",
          ctx,
          countWords,
        ),
      ).toBe(null);
    });
  });

  describe("style.aesthetic", () => {
    const ctx = {
      highlightedCategory: "style.aesthetic",
      highlightedText: "cinematic",
    };

    it("rejects camera-technique drift", () => {
      expect(
        getCategoryDriftRejectReason("handheld tracking", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects camera-movement drift", () => {
      expect(getCategoryDriftRejectReason("dolly out", ctx, countWords)).toBe(
        "category_drift",
      );
    });

    it("rejects light-source clause drift", () => {
      expect(
        getCategoryDriftRejectReason("rear window backlight", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects lighting-direction drift", () => {
      expect(
        getCategoryDriftRejectReason("side-lit profile", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects text without style-strong cue", () => {
      expect(
        getCategoryDriftRejectReason("bright daytime", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts style-strong cue phrasing", () => {
      expect(
        getCategoryDriftRejectReason("painterly aesthetic", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("environment.location", () => {
    const ctx = {
      highlightedCategory: "environment.location",
      highlightedText: "a sunny park",
    };

    it("rejects environment-context drift", () => {
      expect(
        getCategoryDriftRejectReason("dashboard console", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects vehicle-interior drift", () => {
      expect(
        getCategoryDriftRejectReason("inside the car", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects when no external-location cue", () => {
      expect(
        getCategoryDriftRejectReason("warm cozy lighting", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts valid external-location phrasing", () => {
      expect(
        getCategoryDriftRejectReason("shaded park trail", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("environment.context", () => {
    const ctx = {
      highlightedCategory: "environment.context",
      highlightedText: "the dashboard",
    };

    it("rejects external-location drift", () => {
      expect(
        getCategoryDriftRejectReason("shaded park trail", ctx, countWords),
      ).toBe("category_drift");
    });

    it("rejects when no context cue", () => {
      expect(
        getCategoryDriftRejectReason("warm lighting", ctx, countWords),
      ).toBe("category_drift");
    });

    it("accepts valid environment-context phrasing", () => {
      expect(
        getCategoryDriftRejectReason("windshield with haze", ctx, countWords),
      ).toBe(null);
    });
  });

  describe("environment.weather", () => {
    const ctx = {
      highlightedCategory: "environment.weather",
      highlightedText: "gentle breeze",
    };

    it("flags coherence_conflict for disruptive-weather drift from gentle-air", () => {
      // disruptive terms must match as whole words — "hailstorm" is one token
      // where neither "hail" nor "storm" has a word boundary.
      expect(
        getCategoryDriftRejectReason("sudden thick fog", ctx, countWords),
      ).toBe("coherence_conflict");
    });

    it("accepts consistent gentle-weather replacement", () => {
      expect(getCategoryDriftRejectReason("soft breeze", ctx, countWords)).toBe(
        null,
      );
    });

    it("handles environment.weather with missing highlightedText (|| fallback)", () => {
      expect(
        getCategoryDriftRejectReason(
          "sudden fog",
          { highlightedCategory: "environment.weather" },
          countWords,
        ),
      ).toBe(null);
    });

    it("returns null when source weather is not gentle-air", () => {
      expect(
        getCategoryDriftRejectReason(
          "heavy downpour",
          {
            highlightedCategory: "environment.weather",
            highlightedText: "storm",
          },
          countWords,
        ),
      ).toBe(null);
    });
  });

  describe("fallback: unhandled category", () => {
    it("returns null for categories with no specific drift rules", () => {
      expect(
        getCategoryDriftRejectReason(
          "24fps 4k resolution",
          {
            highlightedCategory: "technical.framerate",
            highlightedText: "30fps",
          },
          countWords,
        ),
      ).toBe(null);
    });

    it("returns null for missing category entirely", () => {
      expect(
        getCategoryDriftRejectReason(
          "anything",
          { highlightedCategory: "unknown.xyz" },
          countWords,
        ),
      ).toBe(null);
    });

    it("handles context with no highlightedCategory at all (|| fallback)", () => {
      expect(getCategoryDriftRejectReason("anything", {}, countWords)).toBe(
        null,
      );
    });
  });
});
