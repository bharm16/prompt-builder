import { describe, it, expect } from "vitest";
import { computeCostUsd, PRICING } from "../pricing.js";

describe("pricing", () => {
  it("computes cost for gpt-4o-2024-08-06 at known token counts", () => {
    // 1000 in + 500 out → $0.0025 + $0.005 = $0.0075
    expect(computeCostUsd("gpt-4o-2024-08-06", 1000, 500)).toBeCloseTo(
      0.0075,
      6,
    );
  });

  it("returns 0 for an unknown model rather than throwing", () => {
    expect(computeCostUsd("unknown-model-xyz", 1000, 500)).toBe(0);
  });

  it("exposes the pricing table for snapshot review", () => {
    expect(PRICING).toMatchSnapshot();
  });
});
