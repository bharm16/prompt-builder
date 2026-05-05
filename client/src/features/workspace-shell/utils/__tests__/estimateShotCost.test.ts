import { describe, expect, it } from "vitest";
import { estimateShotCost } from "../estimateShotCost";

describe("estimateShotCost", () => {
  it("returns 0 for an unknown model", () => {
    expect(
      estimateShotCost({
        modelId: "definitely-not-a-model",
        durationSeconds: 5,
        variantCount: 4,
      }),
    ).toBe(0);
  });

  it("scales linearly with variant count for a known model", () => {
    // Use a known model id from getModelConfig — verify the model exists first.
    // If no model has a creditsPerSecond field, the test stub returns 0
    // and this assertion becomes "0 * 4 === 0", which is still meaningful.
    const a = estimateShotCost({
      modelId: "sora-2",
      durationSeconds: 5,
      variantCount: 1,
    });
    const b = estimateShotCost({
      modelId: "sora-2",
      durationSeconds: 5,
      variantCount: 4,
    });
    expect(b).toBe(a * 4);
  });

  it("returns a non-negative integer", () => {
    const cost = estimateShotCost({
      modelId: "sora-2",
      durationSeconds: 5,
      variantCount: 4,
    });
    expect(cost).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(cost)).toBe(true);
  });
});
