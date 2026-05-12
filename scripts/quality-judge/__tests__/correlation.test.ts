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

  it("handles a tie case where ranks diverge (ρ not ±1)", () => {
    // [10,10,20] → ranks [1.5, 1.5, 3]
    // [1,2,3]    → ranks [1, 2, 3]
    // Pearson of [1.5,1.5,3] vs [1,2,3] ≈ 0.866
    expect(spearmanCorrelation([10, 10, 20], [1, 2, 3])).toBeCloseTo(0.866, 2);
  });

  it("returns 0 when one array has zero variance (all-tied)", () => {
    // All x tied → denX=0 → pearson guard returns 0
    expect(spearmanCorrelation([5, 5, 5], [1, 2, 3])).toBe(0);
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

  it("throws on NaN input (silent ρ=1.0 would defeat the calibration gate)", () => {
    expect(() => spearmanCorrelation([1, 2, NaN], [1, 2, 3])).toThrow(/NaN/);
    expect(() => spearmanCorrelation([1, 2, 3], [1, NaN, 3])).toThrow(/NaN/);
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

  it("throws on NaN input", () => {
    expect(() => meanAbsoluteError([1, 2, NaN], [1, 2, 3])).toThrow(/NaN/);
  });
});
