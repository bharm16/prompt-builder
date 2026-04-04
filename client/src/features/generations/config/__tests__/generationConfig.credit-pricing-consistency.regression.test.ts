/**
 * Regression: credit pricing consistency across display, gate, and config layers.
 *
 * Invariant: For any video model, the credit cost used by the generation credit gate
 * (getModelCreditCost) must equal Math.ceil(creditsPerSecond × duration),
 * and both must match the server formula.
 *
 * Root cause: generationConfig.ts had stale static `credits` values (e.g., Sora = 80)
 * while modelConfig.ts and the server used per-second pricing (Sora = 6 cr/sec × 8s = 48).
 * The credit gate in useGenerationsRuntime used the static values, causing the gate to
 * show different prices than the display layer.
 */
import { describe, expect, it } from "vitest";
import {
  DRAFT_MODELS,
  RENDER_MODELS,
  getModelConfig,
  getModelCreditCost,
} from "../generationConfig";

/**
 * Expected per-second rates from modelConfig.ts for active render models.
 * If modelConfig.ts changes, these must be updated — failing tests signal the drift.
 */
const EXPECTED_RENDER_RATES: Record<string, number> = {
  "sora-2": 6,
  "kling-v2-1-master": 5,
  "google/veo-3": 24,
  "luma-ray3": 7,
};

const EXPECTED_DRAFT_RATES: Record<string, number> = {
  "wan-2.2": 3.5,
  "wan-2.5": 3.5,
};

const DEFAULT_DURATION = 8;

describe("regression: credit pricing consistency", () => {
  it("render model creditsPerSecond in generationConfig matches expected rates", () => {
    for (const [modelId, expectedRate] of Object.entries(
      EXPECTED_RENDER_RATES,
    )) {
      const genConfig = getModelConfig(modelId);
      expect(
        genConfig,
        `Missing generationConfig for render model ${modelId}`,
      ).not.toBeNull();
      expect(genConfig!.creditsPerSecond).toBe(expectedRate);
    }
  });

  it("draft model creditsPerSecond in generationConfig matches expected rates", () => {
    for (const [modelId, expectedRate] of Object.entries(
      EXPECTED_DRAFT_RATES,
    )) {
      const genConfig = getModelConfig(modelId);
      expect(
        genConfig,
        `Missing generationConfig for draft model ${modelId}`,
      ).not.toBeNull();
      expect(genConfig!.creditsPerSecond).toBe(expectedRate);
    }
  });

  it("getModelCreditCost equals Math.ceil(creditsPerSecond × duration) for all durations", () => {
    const durations = [4, 5, 8, 10];
    for (const [modelId, rate] of Object.entries(EXPECTED_RENDER_RATES)) {
      for (const duration of durations) {
        const gateCost = getModelCreditCost(modelId, duration);
        const expected = Math.ceil(rate * duration);
        expect(gateCost, `${modelId} at ${duration}s`).toBe(expected);
      }
    }
  });

  it("static credits field equals Math.ceil(creditsPerSecond × 8) for all video models", () => {
    const allModels = { ...DRAFT_MODELS, ...RENDER_MODELS };
    for (const [modelId, config] of Object.entries(allModels)) {
      if (config.creditsPerSecond != null) {
        const expected = Math.ceil(config.creditsPerSecond * DEFAULT_DURATION);
        expect(config.credits, `Static credits mismatch for ${modelId}`).toBe(
          expected,
        );
      }
    }
  });

  it("getModelCreditCost uses creditsPerSecond × duration for video models, not static credits", () => {
    // Sora at 4 seconds should be 24, not the old static 80
    expect(getModelCreditCost("sora-2", 4)).toBe(Math.ceil(6 * 4));
    expect(getModelCreditCost("sora-2", 4)).not.toBe(80);

    // Wan 2.5 at 5 seconds should be 18, not the old static 5
    expect(getModelCreditCost("wan-2.5", 5)).toBe(Math.ceil(3.5 * 5));
    expect(getModelCreditCost("wan-2.5", 5)).not.toBe(5);
  });

  it("getModelCreditCost returns flat credits for non-per-second models", () => {
    // flux-kontext has no creditsPerSecond — should return flat credits regardless of duration
    expect(getModelCreditCost("flux-kontext", 4)).toBe(4);
    expect(getModelCreditCost("flux-kontext", 8)).toBe(4);
    expect(getModelCreditCost("flux-kontext")).toBe(4);
  });

  it("getModelCreditCost defaults to 8-second duration when none provided", () => {
    expect(getModelCreditCost("sora-2")).toBe(Math.ceil(6 * DEFAULT_DURATION));
    expect(getModelCreditCost("wan-2.5")).toBe(
      Math.ceil(3.5 * DEFAULT_DURATION),
    );
  });

  it("getModelCreditCost returns 0 for unknown models", () => {
    expect(getModelCreditCost("nonexistent-model", 8)).toBe(0);
  });
});
