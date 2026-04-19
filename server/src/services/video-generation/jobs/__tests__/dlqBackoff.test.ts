import { describe, expect, it } from "vitest";
import { computeDlqBackoff } from "../dlqBackoff";

describe("computeDlqBackoff", () => {
  it("returns at least the 30s base delay for attempt 0", () => {
    expect(computeDlqBackoff(0, 1000)).toBeGreaterThanOrEqual(30_000);
  });

  it("grows exponentially toward the 5-minute ceiling", () => {
    const a1 = computeDlqBackoff(1, 1000);
    const a3 = computeDlqBackoff(3, 1000);
    const a10 = computeDlqBackoff(10, 1000);

    expect(a3).toBeGreaterThan(a1);
    // 5-minute ceiling must hold for every jitter source.
    for (let now = 0; now < 1000; now += 1) {
      expect(computeDlqBackoff(10, now)).toBeLessThanOrEqual(5 * 60_000);
    }
    // Cap kicks in well before attempt 10.
    expect(a10).toBeLessThanOrEqual(5 * 60_000);
  });

  it("regression: applies jitter so N entries do not retry in lockstep", () => {
    // Two DLQ entries at the same attempt count but different `now` values
    // (as happens when the reprocessor iterates over a batch) must produce
    // different backoffs, preventing provider-outage thundering-herd.
    const a = computeDlqBackoff(3, 100);
    const b = computeDlqBackoff(3, 900);
    expect(a).not.toBe(b);

    // And the spread is meaningful — at least 10% of the uncapped delay.
    const delta = Math.abs(a - b);
    expect(delta).toBeGreaterThan(10_000);
  });

  it("treats a negative or non-integer attempt as zero", () => {
    expect(computeDlqBackoff(-5, 1000)).toBeGreaterThanOrEqual(30_000);
    expect(computeDlqBackoff(Number.NaN, 1000)).toBeGreaterThanOrEqual(30_000);
  });
});
