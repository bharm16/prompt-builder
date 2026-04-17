import { describe, expect, it } from "vitest";
import { getSuggestedPollIntervalMs } from "../pollIntervalPolicy";

describe("getSuggestedPollIntervalMs", () => {
  it("returns fast cadence for openai early in a job", () => {
    expect(getSuggestedPollIntervalMs("openai", 5_000)).toBe(2_000);
  });

  it("returns medium cadence for kling after the fast phase", () => {
    expect(getSuggestedPollIntervalMs("kling", 90_000)).toBe(6_000);
  });

  it("returns slow cadence for replicate after the mid phase", () => {
    expect(getSuggestedPollIntervalMs("replicate", 5 * 60_000)).toBe(10_000);
  });

  it("falls back to the default cadence for an unknown provider", () => {
    expect(getSuggestedPollIntervalMs("never-heard-of-it", 30_000)).toBe(2_000);
    expect(getSuggestedPollIntervalMs(undefined, 30_000)).toBe(2_000);
    expect(getSuggestedPollIntervalMs(undefined, 90_000)).toBe(5_000);
    expect(getSuggestedPollIntervalMs(undefined, 10 * 60_000)).toBe(8_000);
  });
});
