import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

const analyzeAndOptimize = vi.fn();
const calculateQualityScore = vi.fn(() => 91);
const compilePrompt = vi.fn();

vi.mock("../../components/Toast", () => ({
  useToast: () => toast,
}));

vi.mock("../usePromptOptimizerApi", () => ({
  usePromptOptimizerApi: () => ({
    analyzeAndOptimize,
    calculateQualityScore,
    compilePrompt,
  }),
}));

import { usePromptOptimizer } from "../usePromptOptimizer";

describe("regression: failed optimize requests preserve prompt-visible state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores the current prompt state and uses neutral failure copy when optimization fails", async () => {
    analyzeAndOptimize.mockRejectedValueOnce(new Error("Not allowed by CORS"));

    const { result } = renderHook(() => usePromptOptimizer("video", "sora"));

    await act(async () => {
      result.current.setInputPrompt("Original prompt draft");
      result.current.setOptimizedPrompt("Existing optimized prompt");
      result.current.setDisplayedPrompt("Existing optimized prompt");
      result.current.setGenericOptimizedPrompt("Generic fallback prompt");
      result.current.setPreviewPrompt("Preview prompt");
      result.current.setPreviewAspectRatio("9:16");
      result.current.setImprovementContext({ shot: "golden hour" });
      result.current.addLockedSpan({ id: "span-1", text: "golden hour" });
    });

    await act(async () => {
      const outcome = await result.current.optimize();
      expect(outcome).toBeNull();
    });

    expect(result.current.inputPrompt).toBe("Original prompt draft");
    expect(result.current.optimizedPrompt).toBe("Existing optimized prompt");
    expect(result.current.displayedPrompt).toBe("Existing optimized prompt");
    expect(result.current.genericOptimizedPrompt).toBe(
      "Generic fallback prompt",
    );
    expect(result.current.previewPrompt).toBe("Preview prompt");
    expect(result.current.previewAspectRatio).toBe("9:16");
    expect(result.current.improvementContext).toEqual({ shot: "golden hour" });
    expect(result.current.lockedSpans).toEqual([
      { id: "span-1", text: "golden hour" },
    ]);
    expect(result.current.isProcessing).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't optimize the prompt. Please try again.",
    );
  });
});
