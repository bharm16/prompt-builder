import { describe, it, expect } from "vitest";
import { spearmanCorrelation, meanAbsoluteError } from "../correlation.js";

describe("spearmanCorrelation", () => {
  it("returns 1.0 for perfectly monotonic increasing data", () => {
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBe(1);
  });

  it("returns -1.0 for perfectly monotonic decreasing data", () => {
    expect(spearmanCorrelation([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBe(-1);
  });

  it("handles tied ranks (average-rank method)", () => {
    // [10, 10, 20] both tied at lowest → ranks [1.5, 1.5, 3]
    // [5, 5, 9]  same tie pattern → ρ should be 1.0
    expect(spearmanCorrelation([10, 10, 20], [5, 5, 9])).toBeCloseTo(1.0, 6);
  });

  it("returns a value between -1 and 1 for arbitrary data", () => {
    const rho = spearmanCorrelation(
      [3, 1, 4, 1, 5, 9, 2, 6],
      [2, 7, 1, 8, 2, 8, 1, 8],
    );
    expect(rho).toBeGreaterThanOrEqual(-1);
    expect(rho).toBeLessThanOrEqual(1);
  });

  it("throws on mismatched-length arrays", () => {
    expect(() => spearmanCorrelation([1, 2], [1])).toThrow();
  });
});

describe("meanAbsoluteError", () => {
  it("returns 0 for identical arrays", () => {
    expect(meanAbsoluteError([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("computes the mean of absolute differences", () => {
    // |1-2| + |2-4| + |3-6| = 1 + 2 + 3 = 6 ; mean = 2
    expect(meanAbsoluteError([1, 2, 3], [2, 4, 6])).toBe(2);
  });

  it("throws on mismatched-length arrays", () => {
    expect(() => meanAbsoluteError([1, 2], [1])).toThrow();
  });
});
