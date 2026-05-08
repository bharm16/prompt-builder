import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { clampSpanRange } from "../utils/spanRange";

describe("clampSpanRange", () => {
  describe("invalid inputs", () => {
    it("returns null for non-finite start", () => {
      expect(clampSpanRange(Number.NaN, 5, 10)).toBeNull();
      expect(clampSpanRange(Number.POSITIVE_INFINITY, 5, 10)).toBeNull();
      expect(clampSpanRange(Number.NEGATIVE_INFINITY, 5, 10)).toBeNull();
    });

    it("returns null for non-finite end", () => {
      expect(clampSpanRange(0, Number.NaN, 10)).toBeNull();
      expect(clampSpanRange(0, Number.POSITIVE_INFINITY, 10)).toBeNull();
    });

    it("returns null for zero or negative textLength", () => {
      expect(clampSpanRange(0, 5, 0)).toBeNull();
      expect(clampSpanRange(0, 5, -1)).toBeNull();
    });
  });

  describe("clamping behavior", () => {
    it("clamps negative start to 0", () => {
      expect(clampSpanRange(-5, 3, 10)).toEqual({ start: 0, end: 3 });
    });

    it("clamps end past textLength to textLength", () => {
      expect(clampSpanRange(5, 100, 10)).toEqual({ start: 5, end: 10 });
    });

    it("returns null when start is past textLength (collapses to empty)", () => {
      expect(clampSpanRange(20, 25, 10)).toBeNull();
    });

    it("floors fractional inputs", () => {
      expect(clampSpanRange(2.7, 5.9, 10)).toEqual({ start: 2, end: 5 });
    });

    it("preserves a fully in-bounds range", () => {
      expect(clampSpanRange(2, 7, 10)).toEqual({ start: 2, end: 7 });
    });

    it("treats end exactly at textLength as in-bounds", () => {
      expect(clampSpanRange(0, 10, 10)).toEqual({ start: 0, end: 10 });
    });
  });

  describe("degenerate ranges", () => {
    it("returns null when start === end", () => {
      expect(clampSpanRange(5, 5, 10)).toBeNull();
    });

    it("returns null when end < start (after flooring)", () => {
      expect(clampSpanRange(7, 3, 10)).toBeNull();
    });

    it("returns null when both ends are below 0", () => {
      expect(clampSpanRange(-5, -1, 10)).toBeNull();
    });
  });

  describe("invariants (property)", () => {
    it("never returns out-of-bounds or empty ranges", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: -1000, max: 1000 }),
          fc.integer({ min: 1, max: 500 }),
          (start, end, textLength) => {
            const result = clampSpanRange(start, end, textLength);
            if (result === null) return true;
            return (
              result.start >= 0 &&
              result.end <= textLength &&
              result.start < result.end &&
              Number.isInteger(result.start) &&
              Number.isInteger(result.end)
            );
          },
        ),
      );
    });

    it("is idempotent when given an already-clamped span", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 100 }),
          (a, delta, textLength) => {
            const start = Math.min(a, textLength - 1);
            const end = Math.min(start + delta, textLength);
            if (end <= start) return true;
            const first = clampSpanRange(start, end, textLength);
            if (!first) return true;
            const second = clampSpanRange(first.start, first.end, textLength);
            return (
              second !== null &&
              second.start === first.start &&
              second.end === first.end
            );
          },
        ),
      );
    });
  });
});
