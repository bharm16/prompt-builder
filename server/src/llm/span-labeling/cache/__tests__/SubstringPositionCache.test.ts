import { describe, expect, it, vi } from "vitest";
import { SubstringPositionCache } from "../SubstringPositionCache";

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

describe("SubstringPositionCache.findBestMatch", () => {
  // ---------- fail-closed contracts ----------
  // The repair flow is the seam between LLM output and the validator. If repair
  // ever silently snaps to a "close enough" position when the LLM hallucinated
  // text, the canvas highlights the wrong phrase. These tests lock that down.

  describe("hallucinated text (fail-closed)", () => {
    it("returns null when the substring does not appear in the source", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch(
        "a young painter in a worn apron",
        "a young sculptor",
      );

      expect(result).toBeNull();
    });

    it("returns null when the substring is empty", () => {
      const cache = new SubstringPositionCache();
      expect(cache.findBestMatch("any text", "")).toBeNull();
    });

    it("rejects substrings that exceed fuzzy distance threshold", () => {
      const cache = new SubstringPositionCache();
      // Source has "the cat", LLM hallucinates "the elephant" — too different
      // to be a fuzzy off-by-one repair. Must fail closed.
      const result = cache.findBestMatch(
        "the cat sat on a mat",
        "the elephant",
      );

      expect(result).toBeNull();
    });
  });

  // ---------- nearest-occurrence selection ----------
  // When LLM-claimed text appears multiple times in the prompt, the repair
  // must use the LLM's claimed offset as a tiebreaker. Snapping to the first
  // occurrence would silently re-label the wrong phrase after a small edit.

  describe("multiple occurrences", () => {
    const text = "the man saw the man across the street";
    // "the man" appears at index 0 and index 12

    it("returns the first occurrence when no preferred position given", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch(text, "the man");

      expect(result).toEqual({ start: 0, end: 7 });
    });

    it("returns the second occurrence when preferred position is near it", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch(text, "the man", 12);

      expect(result).toEqual({ start: 12, end: 19 });
    });

    it("returns the second occurrence when preferred is past last occurrence", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch(text, "the man", 100);

      expect(result).toEqual({ start: 12, end: 19 });
    });

    it("returns the first occurrence when preferred is before it", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch(text, "the man", -5);

      expect(result).toEqual({ start: 0, end: 7 });
    });

    it("picks the closer of two occurrences when preferred is between them", () => {
      const cache = new SubstringPositionCache();
      // First occ at 0, second at 12. Preferred=10 is closer to second.
      const result = cache.findBestMatch(text, "the man", 10);

      expect(result).toEqual({ start: 12, end: 19 });
    });
  });

  // ---------- case-insensitive direct match ----------
  // The first repair tier handles case-only mismatches without invoking the
  // fuzzy fallback. Test it directly so a regression here doesn't get masked
  // by accidental fuzzy success.

  describe("case-insensitive direct match", () => {
    it("repairs title-case mismatch when source is lowercase", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch("the painter", "The");

      expect(result).toEqual({ start: 0, end: 3 });
    });

    it("repairs uppercase mismatch when source is mixed-case", () => {
      const cache = new SubstringPositionCache();
      const result = cache.findBestMatch("The Painter Studio", "PAINTER");

      expect(result).toEqual({ start: 4, end: 11 });
    });
  });

  // ---------- telemetry ----------
  // Telemetry is a production observability hook. If the test suite uses these
  // counters to detect quality drift, they must increment correctly.

  describe("telemetry counters", () => {
    it("increments exactMatches on a single occurrence", () => {
      const cache = new SubstringPositionCache();
      cache.findBestMatch("a young painter", "young painter");

      expect(cache.getTelemetry().exactMatches).toBe(1);
      expect(cache.getTelemetry().failures).toBe(0);
    });

    it("increments failures on a hallucinated substring", () => {
      const cache = new SubstringPositionCache();
      cache.findBestMatch("a young painter", "a young sculptor");

      expect(cache.getTelemetry().failures).toBe(1);
    });

    it("increments caseInsensitiveMatches on a case-only mismatch", () => {
      const cache = new SubstringPositionCache();
      cache.findBestMatch("the painter", "THE");

      expect(cache.getTelemetry().caseInsensitiveMatches).toBe(1);
    });

    it("resetTelemetry clears all counters", () => {
      const cache = new SubstringPositionCache();
      cache.findBestMatch("a young painter", "young painter");
      cache.resetTelemetry();

      const t = cache.getTelemetry();
      expect(t.exactMatches).toBe(0);
      expect(t.totalRequests).toBe(0);
    });
  });

  // ---------- cache invalidation across texts ----------
  // The cache keys on the current text reference. A stale cache entry would
  // produce phantom matches in unrelated prompts, causing cross-request bleed.

  describe("cache invalidation", () => {
    it("clears prior cache entries when text reference changes", () => {
      const cache = new SubstringPositionCache();
      cache.findBestMatch("alpha beta gamma", "beta");

      // Different text — prior cache must not return stale beta position
      const result = cache.findBestMatch("delta epsilon", "epsilon");
      expect(result).toEqual({ start: 6, end: 13 });
    });

    it("clear() resets internal state", () => {
      const cache = new SubstringPositionCache();
      cache.findBestMatch("alpha beta gamma", "beta");
      cache.clear();

      // After clear, a fresh lookup against new text must work normally
      const result = cache.findBestMatch("delta epsilon", "delta");
      expect(result).toEqual({ start: 0, end: 5 });
    });
  });
});
