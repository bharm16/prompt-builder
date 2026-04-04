import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePromptOptimizerApi } from "@hooks/usePromptOptimizerApi";

const { optimize, compilePrompt, calculateQualityScore } = vi.hoisted(() => ({
  optimize: vi.fn(),
  compilePrompt: vi.fn(),
  calculateQualityScore: vi.fn(),
}));

const { startTimer, endTimer } = vi.hoisted(() => ({
  startTimer: vi.fn(),
  endTimer: vi.fn(() => 42),
}));

vi.mock("@/services", () => ({
  promptOptimizationApiV2: {
    optimize,
    compilePrompt,
    calculateQualityScore,
  },
}));

vi.mock("@/services/LoggingService", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    })),
    startTimer,
    endTimer,
  },
}));

function createLog() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe("usePromptOptimizerApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    optimize.mockResolvedValue({ prompt: "optimized" });
    compilePrompt.mockResolvedValue({ compiledPrompt: "compiled" });
    calculateQualityScore.mockReturnValue(86);
  });

  it("forwards selected mode and params to optimize", async () => {
    const log = createLog();
    const { result } = renderHook(() =>
      usePromptOptimizerApi("video", log as never),
    );
    const signal = new AbortController().signal;

    await result.current.analyzeAndOptimize({
      prompt: "source prompt",
      targetModel: "sora-2",
      context: { tone: "cinematic" },
      brainstormContext: { style: "moody" },
      generationParams: { quality: "high" } as never,
      skipCache: true,
      lockedSpans: [
        { id: "span-1", text: "source", category: "subject.identity" },
      ] as never,
      startImage: "https://example.com/image.png",
      sourcePrompt: "seed prompt",
      constraintMode: "strict",
      signal,
    });

    expect(optimize).toHaveBeenCalledWith({
      prompt: "source prompt",
      mode: "video",
      targetModel: "sora-2",
      context: { tone: "cinematic" },
      brainstormContext: { style: "moody" },
      generationParams: { quality: "high" },
      skipCache: true,
      lockedSpans: [
        { id: "span-1", text: "source", category: "subject.identity" },
      ],
      startImage: "https://example.com/image.png",
      sourcePrompt: "seed prompt",
      constraintMode: "strict",
      signal,
    });
    expect(startTimer).toHaveBeenCalledWith("analyzeAndOptimize");
    expect(endTimer).toHaveBeenCalledWith("analyzeAndOptimize");
  });

  it("rethrows optimize failures after ending timers", async () => {
    const log = createLog();
    const failure = new Error("optimize failed");
    optimize.mockRejectedValueOnce(failure);
    const { result } = renderHook(() =>
      usePromptOptimizerApi("video", log as never),
    );

    await expect(
      result.current.analyzeAndOptimize({
        prompt: "source prompt",
      }),
    ).rejects.toThrow("optimize failed");

    expect(endTimer).toHaveBeenCalledWith("analyzeAndOptimize");
    expect(log.error).toHaveBeenCalledWith(
      "analyzeAndOptimize failed",
      failure,
    );
  });

  it("delegates compilePrompt and calculateQualityScore", async () => {
    const { result } = renderHook(() =>
      usePromptOptimizerApi("video", createLog() as never),
    );

    await result.current.compilePrompt({
      prompt: "optimized prompt",
      targetModel: "sora-2",
      context: { shots: 3 },
    });
    const score = result.current.calculateQualityScore("input", "output");

    expect(compilePrompt).toHaveBeenCalledWith({
      prompt: "optimized prompt",
      targetModel: "sora-2",
      context: { shots: 3 },
    });
    expect(calculateQualityScore).toHaveBeenCalledWith("input", "output");
    expect(score).toBe(86);
  });
});
