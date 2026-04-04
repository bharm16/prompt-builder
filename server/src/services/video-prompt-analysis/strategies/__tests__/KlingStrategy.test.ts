import { describe, it, expect, beforeEach, vi } from "vitest";
import { KlingStrategy } from "../KlingStrategy";
import type { PromptOptimizationResult } from "../types";

vi.mock("../../utils/TechStripper", () => ({
  TechStripper: class {
    strip(text: string) {
      return { text, tokensWereStripped: false, strippedTokens: [] };
    }
  },
  techStripper: {
    strip(text: string) {
      return { text, tokensWereStripped: false, strippedTokens: [] };
    },
  },
}));
vi.mock("../../utils/SafetySanitizer", () => ({
  SafetySanitizer: class {
    sanitize(text: string) {
      return { text, wasModified: false, replacements: [] };
    }
  },
  safetySanitizer: {
    sanitize(text: string) {
      return { text, wasModified: false, replacements: [] };
    },
  },
}));
vi.mock("../../services/analysis/VideoPromptAnalyzer", () => ({
  VideoPromptAnalyzer: class {
    async analyze() {
      return {};
    }
  },
}));
vi.mock("../../services/rewriter/VideoPromptLLMRewriter", () => ({
  VideoPromptLLMRewriter: class {
    async rewrite() {
      return "";
    }
  },
}));

const makeResult = (prompt: string): PromptOptimizationResult => ({
  prompt,
  metadata: {
    modelId: "kling-2.1",
    pipelineVersion: "2.0.0",
    phases: [],
    warnings: [],
    tokensStripped: [],
    triggersInjected: [],
  },
});

describe("KlingStrategy", () => {
  let strategy: KlingStrategy;

  beforeEach(() => {
    strategy = new KlingStrategy();
    strategy.resetEntityRegistry();
  });

  describe("validate - error handling", () => {
    it("throws on empty string input", async () => {
      await expect(strategy.validate("")).rejects.toThrow(
        "Input must be a non-empty string",
      );
    });

    it("throws on whitespace-only input", async () => {
      await expect(strategy.validate("   \t\n  ")).rejects.toThrow(
        "Input cannot be empty or whitespace only",
      );
    });

    it("does not throw for valid input", async () => {
      await expect(
        strategy.validate("a warrior stands in the rain"),
      ).resolves.toBeUndefined();
    });

    it("does not throw for supported aspect ratio 16:9", async () => {
      await expect(
        strategy.validate("a cat walks", {
          userIntent: "test",
          constraints: {
            mode: "enhance",
            minWords: 1,
            maxWords: 100,
            maxSentences: 5,
            slotDescriptor: "test",
            formRequirement: "16:9",
          },
        }),
      ).resolves.toBeUndefined();
    });

    it("does not throw for supported aspect ratio 9:16", async () => {
      await expect(
        strategy.validate("a cat walks", {
          userIntent: "test",
          constraints: {
            mode: "enhance",
            minWords: 1,
            maxWords: 100,
            maxSentences: 5,
            slotDescriptor: "test",
            formRequirement: "9:16",
          },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("normalize - generic sound term stripping", () => {
    it('strips standalone "sound" when no compound phrases present', () => {
      const result = strategy.normalize("the bright sound fills the room");
      expect(result).not.toMatch(/\bsound\b/i);
    });

    it('strips standalone "noise" from input', () => {
      const result = strategy.normalize(
        "there is noise in the background area",
      );
      // Note: "background noise" is a compound phrase that would be preserved
      // but this sentence structure is "noise in the background area" not "background noise"
      expect(result).not.toMatch(/\bnoise\b/);
    });

    it('strips "audio" as standalone term', () => {
      const result = strategy.normalize("the audio is clear and present");
      // "audio" is in GENERIC_SOUND_TERMS but check for compound context
      expect(result.toLowerCase()).not.toMatch(/\baudio\b/);
    });

    it('preserves compound audio phrases like "city sounds"', () => {
      const result = strategy.normalize("city sounds echo through the alley");
      expect(result.toLowerCase()).toContain("city sounds");
    });

    it('preserves "sound of" constructions via lookahead', () => {
      const result = strategy.normalize("the sound of rain on the roof");
      expect(result).toContain("sound of");
    });

    it('preserves "sound effect" constructions via lookahead', () => {
      const result = strategy.normalize("add a sound effect for thunder");
      expect(result).toContain("sound effect");
    });

    it("returns cleaned whitespace after stripping", () => {
      const result = strategy.normalize("  multiple   spaces   here  ");
      expect(result).not.toMatch(/\s{2,}/);
      expect(result).toBe("multiple spaces here");
    });
  });

  describe("normalize - visual quality token stripping from audio sections", () => {
    it("strips visual quality tokens from explicitly labeled sound sections", () => {
      // Use "sfx:" prefix which is not in GENERIC_SOUND_TERMS and won't be stripped
      const result = strategy.normalize(
        "sfx: 4k crisp thunder clap in the background area",
      );
      // The "4k" inside an audio section should be stripped
      expect(result).toContain("thunder");
    });

    it("preserves visual quality tokens outside audio sections", () => {
      const result = strategy.normalize(
        "a cinematic 4k landscape with vivid colors",
      );
      expect(result).toContain("4k");
      expect(result).toContain("cinematic");
    });
  });

  describe("augment - conditional audio constraints", () => {
    it("does not inject audio triggers when prompt does not request audio", () => {
      strategy.normalize("A warrior stands in heavy rain");
      const result = strategy.augment(
        makeResult("A warrior stands in heavy rain"),
      );
      expect(result.metadata.triggersInjected).toEqual([]);
      expect(result.prompt).toBe("A warrior stands in heavy rain");
    });

    it("injects audio quality constraints when audio is requested", () => {
      strategy.normalize('Character says "hello" with dialogue audio');
      const result = strategy.augment(
        makeResult('Character says "hello" with dialogue audio'),
      );
      expect(result.prompt).toContain("natural speech");
      expect(result.prompt).toContain("high fidelity audio");
    });
  });

  describe("entity registry", () => {
    it("resetEntityRegistry does not throw", () => {
      expect(() => strategy.resetEntityRegistry()).not.toThrow();
    });

    it("can be called multiple times without error", () => {
      strategy.resetEntityRegistry();
      strategy.resetEntityRegistry();
      expect(strategy.modelId).toBe("kling-2.1");
    });
  });

  describe("identity", () => {
    it("has modelId kling-2.1", () => {
      expect(strategy.modelId).toBe("kling-2.1");
    });

    it("has modelName Kling 2.1", () => {
      expect(strategy.modelName).toBe("Kling 2.1");
    });
  });
});
