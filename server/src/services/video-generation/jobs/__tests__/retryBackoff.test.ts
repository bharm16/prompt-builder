import { describe, expect, it } from "vitest";
import { computeRetryBackoffMs } from "../retryBackoff";

describe("computeRetryBackoffMs", () => {
  it("returns at least the base delay for the first retry", () => {
    expect(computeRetryBackoffMs(0, 1000)).toBeGreaterThanOrEqual(30_000);
  });

  it("grows exponentially up to the ceiling (5 minutes), strictly enforced", () => {
    const attempt1 = computeRetryBackoffMs(1, 1000);
    const attempt3 = computeRetryBackoffMs(3, 1000);

    expect(attempt3).toBeGreaterThan(attempt1);
    // The 5-minute ceiling must hold for every possible `now` (jitter source).
    for (let now = 0; now < 1000; now += 1) {
      expect(computeRetryBackoffMs(10, now)).toBeLessThanOrEqual(5 * 60_000);
    }
  });

  it("applies deterministic jitter based on the `now` argument", () => {
    // Different `now` values should produce different backoffs (via jitter).
    const a = computeRetryBackoffMs(2, 100);
    const b = computeRetryBackoffMs(2, 900);
    expect(a).not.toBe(b);
  });

  it("treats a negative/non-integer attempt count as zero", () => {
    expect(computeRetryBackoffMs(-5, 1000)).toBeGreaterThanOrEqual(30_000);
    expect(computeRetryBackoffMs(Number.NaN, 1000)).toBeGreaterThanOrEqual(
      30_000,
    );
  });
});
