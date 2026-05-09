import { beforeEach, describe, expect, it, vi } from "vitest";

const { labelSpansMock, getCurrentSpanProviderMock } = vi.hoisted(() => ({
  labelSpansMock: vi.fn(),
  getCurrentSpanProviderMock: vi.fn(() => "openai"),
}));

vi.mock("../../SpanLabelingService", () => ({
  labelSpans: labelSpansMock,
}));

vi.mock("../../services/LlmClientFactory", () => ({
  getCurrentSpanProvider: getCurrentSpanProviderMock,
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { CachedPromptSpanProvider } from "../CachedPromptSpanProvider";
import type { AIExecutionPort } from "@services/ai-model/ports/AIExecutionPort";
import type { SpanLabelingCacheService } from "@services/cache/SpanLabelingCacheService";

const SAMPLE_RESULT = {
  spans: [{ text: "subject", role: "subject", start: 0, end: 7 }],
  meta: { version: "v1", notes: "ok" },
};

function createAiServiceStub(): AIExecutionPort {
  return {
    getOperationConfig: () => undefined,
  } as unknown as AIExecutionPort;
}

describe("CachedPromptSpanProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    labelSpansMock.mockResolvedValue(SAMPLE_RESULT);
  });

  it("falls through to labelSpans when no cache is configured", async () => {
    const ai = createAiServiceStub();
    const provider = new CachedPromptSpanProvider(ai, null);

    const spans = await provider.label("a prompt");

    expect(labelSpansMock).toHaveBeenCalledTimes(1);
    expect(labelSpansMock).toHaveBeenCalledWith({ text: "a prompt" }, ai);
    expect(spans).toEqual(SAMPLE_RESULT.spans);
  });

  it("returns cached spans without invoking labelSpans on cache hit", async () => {
    const ai = createAiServiceStub();

    // First call computes, second call should hit the cache.
    const cache = {
      getOrCompute: vi
        .fn()
        .mockImplementationOnce(async (_t, _p, _v, compute) => ({
          value: await compute(),
          source: "computed" as const,
        }))
        .mockImplementationOnce(async () => ({
          value: SAMPLE_RESULT,
          source: "cache" as const,
        })),
    } as unknown as SpanLabelingCacheService;

    const provider = new CachedPromptSpanProvider(ai, cache);

    const first = await provider.label("a prompt");
    const second = await provider.label("a prompt");

    expect(first).toEqual(SAMPLE_RESULT.spans);
    expect(second).toEqual(SAMPLE_RESULT.spans);
    // labelSpans should only have run once — the cache short-circuits the LLM call.
    expect(labelSpansMock).toHaveBeenCalledTimes(1);
  });

  it("forwards optional labeling parameters into labelSpans", async () => {
    const ai = createAiServiceStub();
    const provider = new CachedPromptSpanProvider(ai, null);

    await provider.label("a prompt", { maxSpans: 12, minConfidence: 0.5 });

    expect(labelSpansMock).toHaveBeenCalledWith(
      { text: "a prompt", maxSpans: 12, minConfidence: 0.5 },
      ai,
    );
  });

  it("uses the cache key derived from policy + templateVersion", async () => {
    const ai = createAiServiceStub();
    const cache = {
      getOrCompute: vi.fn().mockResolvedValue({
        value: SAMPLE_RESULT,
        source: "cache" as const,
      }),
    } as unknown as SpanLabelingCacheService;

    const provider = new CachedPromptSpanProvider(ai, cache);
    await provider.label("a prompt", {
      policy: { strict: true },
      templateVersion: "v1",
    });

    expect(cache.getOrCompute).toHaveBeenCalledWith(
      "a prompt",
      { strict: true },
      "v1",
      expect.any(Function),
      expect.objectContaining({ provider: "openai" }),
    );
  });

  it("labelFull returns the full LabelSpansResult including meta", async () => {
    const ai = createAiServiceStub();
    const provider = new CachedPromptSpanProvider(ai, null);

    const result = await provider.labelFull("a prompt");

    expect(result).toEqual(SAMPLE_RESULT);
    expect(labelSpansMock).toHaveBeenCalledTimes(1);
  });
});
