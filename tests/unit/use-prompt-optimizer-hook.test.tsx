import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePromptOptimizer } from "@hooks/usePromptOptimizer";

const {
  useToast,
  usePromptOptimizerApi,
  usePromptOptimizerState,
  runOptimization,
  markOptimizationStart,
  logDebug,
  logError,
  startTimer,
  endTimer,
} = vi.hoisted(() => ({
  useToast: vi.fn(),
  usePromptOptimizerApi: vi.fn(),
  usePromptOptimizerState: vi.fn(),
  runOptimization: vi.fn(),
  markOptimizationStart: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(() => 12),
}));

vi.mock("@components/Toast", () => ({
  useToast,
}));

vi.mock("@hooks/usePromptOptimizerApi", () => ({
  usePromptOptimizerApi,
}));

vi.mock("@hooks/usePromptOptimizerState", () => ({
  usePromptOptimizerState,
}));

vi.mock("@hooks/utils/promptOptimizationFlow", () => ({
  runOptimization,
}));

vi.mock("@hooks/utils/performanceMetrics", () => ({
  markOptimizationStart,
}));

vi.mock("@/services/LoggingService", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: logDebug,
      error: logError,
    })),
    startTimer,
    endTimer,
  },
}));

function createStateHookResult() {
  const state = {
    inputPrompt: "state prompt",
    isProcessing: false,
    optimizedPrompt: "",
    displayedPrompt: "",
    genericOptimizedPrompt: null,
    previewPrompt: null,
    previewAspectRatio: null,
    qualityScore: null,
    skipAnimation: false,
    improvementContext: { stateContext: true },
    optimizationResultVersion: 0,
    lockedSpans: [
      {
        id: "locked-1",
        text: "subject",
        category: "subject.identity",
      },
    ],
  };

  return {
    state,
    setInputPrompt: vi.fn(),
    setOptimizedPrompt: vi.fn(),
    setDisplayedPrompt: vi.fn(),
    setGenericOptimizedPrompt: vi.fn(),
    setQualityScore: vi.fn(),
    setPreviewPrompt: vi.fn(),
    setPreviewAspectRatio: vi.fn(),
    setSkipAnimation: vi.fn(),
    setImprovementContext: vi.fn(),
    bumpOptimizationResultVersion: vi.fn(),
    setLockedSpans: vi.fn(),
    addLockedSpan: vi.fn(),
    removeLockedSpan: vi.fn(),
    clearLockedSpans: vi.fn(),
    snapshotForRollback: vi.fn(),
    rollback: vi.fn(),
    startOptimization: vi.fn(),
    resetPrompt: vi.fn(),
    setIsProcessing: vi.fn(),
  };
}

function createApiHookResult() {
  return {
    analyzeAndOptimize: vi.fn(),
    compilePrompt: vi.fn(),
    calculateQualityScore: vi.fn(() => 87),
  };
}

describe("usePromptOptimizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useToast.mockReturnValue({
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    });
    usePromptOptimizerState.mockReturnValue(createStateHookResult());
    usePromptOptimizerApi.mockReturnValue(createApiHookResult());
    runOptimization.mockResolvedValue({ optimized: "json output", score: 91 });
  });

  it("routes optimization through the unified JSON flow", async () => {
    const { result } = renderHook(() => usePromptOptimizer("video", "sora-2"));
    const outcome = await act(async () =>
      result.current.optimize(
        "input prompt",
        { uiContext: "A" },
        { brainstorm: "B" },
        undefined,
        {
          skipCache: true,
          generationParams: { quality: "high" } as never,
        },
      ),
    );

    expect(runOptimization).toHaveBeenCalledTimes(1);
    expect(runOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        promptToOptimize: "input prompt",
        selectedMode: "video",
        selectedModel: "sora-2",
        context: { uiContext: "A" },
        brainstormContext: { brainstorm: "B" },
        generationParams: { quality: "high" },
        skipCache: true,
      }),
    );
    expect(markOptimizationStart).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ optimized: "json output", score: 91 });
  });

  it("uses targetModel override when provided", async () => {
    const { result } = renderHook(() => usePromptOptimizer("video", "sora-2"));

    await act(async () => {
      await result.current.optimize("input prompt", null, null, "kling-26");
    });

    expect(runOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedModel: "kling-26",
      }),
    );
  });

  it("returns null and warns when prompt is empty", async () => {
    const toast = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };
    useToast.mockReturnValueOnce(toast);
    const { result } = renderHook(() => usePromptOptimizer("video", "sora-2"));

    let response = null;
    await act(async () => {
      response = await result.current.optimize("   ");
    });

    expect(response).toBeNull();
    expect(toast.warning).toHaveBeenCalledWith("Please enter a prompt");
    expect(runOptimization).not.toHaveBeenCalled();
  });
});
