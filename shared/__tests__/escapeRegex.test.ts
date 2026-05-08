import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { escapeRegex } from "../utils/escapeRegex";

describe("escapeRegex", () => {
  describe("escaping known regex metacharacters", () => {
    it("escapes . * + ? ^ $ | individually", () => {
      expect(escapeRegex(".")).toBe("\\.");
      expect(escapeRegex("*")).toBe("\\*");
      expect(escapeRegex("+")).toBe("\\+");
      expect(escapeRegex("?")).toBe("\\?");
      expect(escapeRegex("^")).toBe("\\^");
      expect(escapeRegex("$")).toBe("\\$");
      expect(escapeRegex("|")).toBe("\\|");
    });

    it("escapes parentheses, brackets, and braces", () => {
      expect(escapeRegex("(")).toBe("\\(");
      expect(escapeRegex(")")).toBe("\\)");
      expect(escapeRegex("[")).toBe("\\[");
      expect(escapeRegex("]")).toBe("\\]");
      expect(escapeRegex("{")).toBe("\\{");
      expect(escapeRegex("}")).toBe("\\}");
    });

    it("escapes the backslash character itself", () => {
      expect(escapeRegex("\\")).toBe("\\\\");
    });

    it("escapes mixed-metacharacter strings", () => {
      expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
      expect(escapeRegex("(group|alt)?")).toBe("\\(group\\|alt\\)\\?");
      expect(escapeRegex("[range]{1,2}")).toBe("\\[range\\]\\{1,2\\}");
    });
  });

  describe("non-special characters pass through", () => {
    it("leaves alphanumerics untouched", () => {
      expect(escapeRegex("hello world 123")).toBe("hello world 123");
    });

    it("leaves whitespace and punctuation that aren't regex metas alone", () => {
      expect(escapeRegex("a, b; c: d!")).toBe("a, b; c: d!");
      expect(escapeRegex("under_score-dash")).toBe("under_score-dash");
    });

    it("returns empty string for empty input", () => {
      expect(escapeRegex("")).toBe("");
    });
  });

  describe("invariant: escaped output matches the original input literally", () => {
    it("any input s satisfies new RegExp(escapeRegex(s)).test(s) === true", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 200 }), (input) => {
          const pattern = new RegExp(escapeRegex(input));
          return pattern.test(input);
        }),
        { numRuns: 200 },
      );
    });

    it("does not match a string that differs from the original by exactly one regex meta", () => {
      // Sanity: escaping prevents accidental matches via metacharacter expansion.
      const pattern = new RegExp(`^${escapeRegex("a.b")}$`);
      expect(pattern.test("a.b")).toBe(true);
      expect(pattern.test("axb")).toBe(false);
      expect(pattern.test("ab")).toBe(false);
    });
  });
});
