import { describe, it, expect, afterEach } from "vitest";
import { createEvalEmitter, resolveDistinctId } from "../posthog-emitter.js";

describe("createEvalEmitter", () => {
  const originalKey = process.env.POSTHOG_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.POSTHOG_API_KEY;
    } else {
      process.env.POSTHOG_API_KEY = originalKey;
    }
  });

  it("returns a no-op stub when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY;
    const emitter = createEvalEmitter();
    expect(() =>
      emitter.emit({
        distinctId: "test",
        event: "eval.completed",
        properties: {
          evalType: "span_labeling_f1",
          outcome: "passed",
          commit: "abc",
          durationMs: 1,
          promptCount: 1,
          errorCount: 0,
          metrics: {
            overallF1: 1,
            overallPrecision: 1,
            overallRecall: 1,
            perCategoryF1: {},
          },
        },
      }),
    ).not.toThrow();
    await emitter.shutdown();
  });

  it("returns a no-op stub when POSTHOG_API_KEY is empty whitespace", async () => {
    process.env.POSTHOG_API_KEY = "   ";
    const emitter = createEvalEmitter();
    await expect(emitter.shutdown()).resolves.not.toThrow();
  });
});

describe("resolveDistinctId", () => {
  const originalRunId = process.env.GITHUB_RUN_ID;
  afterEach(() => {
    if (originalRunId === undefined) {
      delete process.env.GITHUB_RUN_ID;
    } else {
      process.env.GITHUB_RUN_ID = originalRunId;
    }
  });

  it("returns ci-<runId> when GITHUB_RUN_ID is set", () => {
    process.env.GITHUB_RUN_ID = "12345";
    expect(resolveDistinctId()).toBe("ci-12345");
  });

  it("returns local-<username> when GITHUB_RUN_ID is unset", () => {
    delete process.env.GITHUB_RUN_ID;
    expect(resolveDistinctId()).toMatch(/^local-/);
  });
});
