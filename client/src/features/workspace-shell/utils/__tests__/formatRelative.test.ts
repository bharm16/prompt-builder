import { describe, expect, it } from "vitest";
import { formatRelative } from "../formatRelative";

describe("formatRelative", () => {
  // Anchored "now" for deterministic assertions; no Date.now() mocking needed.
  const NOW = 1_700_000_000_000;

  it("returns 'just now' when delta is under 1 minute", () => {
    expect(formatRelative(NOW - 0, NOW)).toBe("just now");
    expect(formatRelative(NOW - 30_000, NOW)).toBe("just now");
    expect(formatRelative(NOW - 59_999, NOW)).toBe("just now");
  });

  it("returns Nm ago for deltas between 1 and 59 minutes", () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe("1m ago");
    expect(formatRelative(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatRelative(NOW - 59 * 60_000, NOW)).toBe("59m ago");
  });

  it("returns Nh ago for deltas between 1 and 23 hours", () => {
    expect(formatRelative(NOW - 60 * 60_000, NOW)).toBe("1h ago");
    expect(formatRelative(NOW - 23 * 60 * 60_000, NOW)).toBe("23h ago");
  });

  it("returns Nd ago for deltas of 24+ hours", () => {
    expect(formatRelative(NOW - 24 * 60 * 60_000, NOW)).toBe("1d ago");
    expect(formatRelative(NOW - 7 * 24 * 60 * 60_000, NOW)).toBe("7d ago");
  });

  it("treats future timestamps (epoch > now) as 'just now' rather than negative values", () => {
    // A clock-skew or test-fixture-future timestamp shouldn't render "-1m ago".
    expect(formatRelative(NOW + 30_000, NOW)).toBe("just now");
  });
});
