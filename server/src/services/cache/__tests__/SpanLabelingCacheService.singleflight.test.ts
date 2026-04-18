import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpanLabelingCacheService } from "../SpanLabelingCacheService";

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SpanLabelingCacheService single-flight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes compute exactly once when 5 concurrent callers miss the same key", async () => {
    const service = new SpanLabelingCacheService({ redis: null });

    let callCount = 0;
    const slowCompute = async (): Promise<{ spans: string[] }> => {
      callCount++;
      // Simulate an expensive LLM call by yielding to the event loop a few times
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { spans: ["subject"] };
    };

    const concurrency = 5;
    const text = "prompt-under-contention";
    const policy = null;
    const templateVersion = "v1";

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        service.getOrCompute(text, policy, templateVersion, slowCompute),
      ),
    );

    // Invariant: the underlying compute ran exactly once despite N concurrent misses
    expect(callCount).toBe(1);
    // All callers receive the same result
    expect(results).toHaveLength(concurrency);
    for (const r of results) {
      expect(r).toEqual({ spans: ["subject"] });
    }
  });

  it("runs compute a second time after the first flight completes and cache expires", async () => {
    const service = new SpanLabelingCacheService({ redis: null });

    let callCount = 0;
    const compute = async (): Promise<{ value: number }> => {
      callCount++;
      return { value: callCount };
    };

    await service.getOrCompute("k", null, "v1", compute);
    // Invalidate to simulate fresh miss
    await service.invalidate("k", null, "v1");
    await service.getOrCompute("k", null, "v1", compute);

    expect(callCount).toBe(2);
  });

  it("releases inflight slot after compute rejects so retries can re-run", async () => {
    const service = new SpanLabelingCacheService({ redis: null });

    let attempts = 0;
    const flaky = async (): Promise<string> => {
      attempts++;
      if (attempts === 1) {
        throw new Error("first attempt fails");
      }
      return "ok";
    };

    await expect(
      service.getOrCompute("flaky-key", null, "v1", flaky),
    ).rejects.toThrow("first attempt fails");

    // Second attempt should run compute again (not a stale rejected promise)
    const result = await service.getOrCompute("flaky-key", null, "v1", flaky);
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});
