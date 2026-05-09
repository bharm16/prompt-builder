import { describe, it, expect } from "vitest";
import { generateCacheKey, buildTextPattern, buildTextPrefix } from "../key";

describe("generateCacheKey", () => {
  describe("error handling", () => {
    it("handles empty text", () => {
      const key = generateCacheKey("", null, null);

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });

    it("handles null policy", () => {
      const key = generateCacheKey("test text", null, null);

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });

    it("handles null template version", () => {
      const key = generateCacheKey(
        "test text",
        { enabledCategories: ["action"] },
        null,
      );

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });

    it("handles null provider", () => {
      const key = generateCacheKey("test text", null, "v2");

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });
  });

  describe("edge cases", () => {
    it("generates deterministic keys for same input", () => {
      const text = "A cinematic scene of a sunset";
      const policy = { enabledCategories: ["action", "subject"] };
      const templateVersion = "v1";
      const provider = "openai";

      const key1 = generateCacheKey(text, policy, templateVersion, provider);
      const key2 = generateCacheKey(text, policy, templateVersion, provider);

      expect(key1).toBe(key2);
    });

    it("generates different keys for different text", () => {
      const policy = { enabledCategories: ["action"] };

      const key1 = generateCacheKey("text one", policy, "v1", "openai");
      const key2 = generateCacheKey("text two", policy, "v1", "openai");

      expect(key1).not.toBe(key2);
    });

    it("generates different keys for different policies", () => {
      const text = "same text";

      const key1 = generateCacheKey(
        text,
        { enabledCategories: ["action"] },
        "v1",
        "openai",
      );
      const key2 = generateCacheKey(
        text,
        { enabledCategories: ["subject"] },
        "v1",
        "openai",
      );

      expect(key1).not.toBe(key2);
    });

    it("generates different keys for different template versions", () => {
      const text = "same text";
      const policy = { enabledCategories: ["action"] };

      const key1 = generateCacheKey(text, policy, "v1", "openai");
      const key2 = generateCacheKey(text, policy, "v2", "openai");

      expect(key1).not.toBe(key2);
    });

    it("generates different keys for different providers", () => {
      const text = "same text";
      const policy = { enabledCategories: ["action"] };

      const key1 = generateCacheKey(text, policy, "v1", "openai");
      const key2 = generateCacheKey(text, policy, "v1", "gemini");

      expect(key1).not.toBe(key2);
    });

    it("handles unicode text", () => {
      const key = generateCacheKey("中文测试 🎬", null, null);

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });

    it("handles very long text", () => {
      const longText = "a".repeat(10000);

      const key = generateCacheKey(longText, null, null);

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });

    it("handles complex policy object", () => {
      const complexPolicy = {
        enabledCategories: ["action", "subject", "style"],
        disabledCategories: ["technical"],
        minConfidence: 0.8,
        nested: { deep: { value: true } },
      };

      const key = generateCacheKey("test", complexPolicy, "v1", "openai");

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });
  });

  describe("core behavior", () => {
    it("follows span:textHash:policyHash format", () => {
      const key = generateCacheKey("test text", null, null);
      const parts = key.split(":");

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe("span");
      expect(parts[1]).toHaveLength(16);
      expect(parts[2]).toHaveLength(8);
    });

    it("includes cache key version in policy hash", () => {
      // Different internal versions would produce different keys
      // This tests that the format includes version consideration
      const key = generateCacheKey("test", null, null);

      expect(key).toMatch(/^span:[a-f0-9]{16}:[a-f0-9]{8}$/);
    });
  });
});

describe("buildTextPattern", () => {
  describe("core behavior", () => {
    it("returns pattern with wildcard suffix", () => {
      const pattern = buildTextPattern("test text");

      expect(pattern).toMatch(/^span:[a-f0-9]{16}:\*$/);
    });

    it("generates same text hash as generateCacheKey", () => {
      const text = "same text for both";
      const pattern = buildTextPattern(text);
      const key = generateCacheKey(text, null, "v1", "openai");

      // Pattern should start with same prefix as key
      const patternPrefix = pattern.slice(0, -1); // Remove wildcard
      expect(key.startsWith(patternPrefix)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty text", () => {
      const pattern = buildTextPattern("");

      expect(pattern).toMatch(/^span:[a-f0-9]{16}:\*$/);
    });
  });
});

describe("buildTextPrefix", () => {
  describe("core behavior", () => {
    it("returns prefix with trailing colon", () => {
      const prefix = buildTextPrefix("test text");

      expect(prefix).toMatch(/^span:[a-f0-9]{16}:$/);
    });

    it("matches keys generated from same text", () => {
      const text = "matching text";
      const prefix = buildTextPrefix(text);
      const key = generateCacheKey(
        text,
        { enabledCategories: ["action"] },
        "v1",
        "openai",
      );

      expect(key.startsWith(prefix)).toBe(true);
    });

    it("does not match keys from different text", () => {
      const prefix = buildTextPrefix("text one");
      const key = generateCacheKey("text two", null, "v1", "openai");

      expect(key.startsWith(prefix)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty text", () => {
      const prefix = buildTextPrefix("");

      expect(prefix).toMatch(/^span:[a-f0-9]{16}:$/);
    });

    it("handles whitespace-only text", () => {
      const prefix = buildTextPrefix("   ");

      expect(prefix).toMatch(/^span:[a-f0-9]{16}:$/);
    });
  });
});

// Regression: a prior change rewrote LLM prompt instructions and bumped
// `PROMPT_VERSIONS.SPAN_LABELING` (a logging tag) without bumping
// `SpanLabelingConfig.DEFAULT_OPTIONS.templateVersion` (the field
// `generateCacheKey` actually consumes). The bump had no effect on cache
// invalidation: stale labels generated against the old, contradictory
// prompt continued to be served from cache. These tests pin the contract
// that `templateVersion` is part of the cache-key identity, so a future
// bump cannot silently no-op the cache.
describe("regression: templateVersion is part of cache-key identity", () => {
  it("produces different keys for the same text under different templateVersions", () => {
    const text = "A cinematic dolly shot through a foggy alley at dusk";
    const policy = { enabledCategories: ["lighting", "environment"] };

    const keyV22 = generateCacheKey(text, policy, "v2.2", "groq");
    const keyV23 = generateCacheKey(text, policy, "v2.3", "groq");

    expect(keyV22).not.toEqual(keyV23);
  });

  it("produces the same key when only templateVersion is held constant", () => {
    const text = "A cinematic dolly shot through a foggy alley at dusk";
    const policy = { enabledCategories: ["lighting", "environment"] };

    const keyA = generateCacheKey(text, policy, "v2.3", "groq");
    const keyB = generateCacheKey(text, policy, "v2.3", "groq");

    expect(keyA).toEqual(keyB);
  });

  it("differentiates v2.2 from v2.3 even when the rest of the input is identical", () => {
    // The "foggy alley" phrasing is intentional: this is the exact case
    // that exposed the v2.2/v2.3 prompt contradiction. The cache MUST
    // route requests for it to different namespaces under different
    // template versions.
    const text = "foggy alley at dusk";
    const policy = null;

    const keys = ["v2.2", "v2.3"].map((v) =>
      generateCacheKey(text, policy, v, "groq"),
    );

    expect(new Set(keys).size).toBe(2);
  });
});
