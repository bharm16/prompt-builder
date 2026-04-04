import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { usePromptHistoryActions } from "../usePromptHistoryActions";

/**
 * Regression: handleCreateNew must eagerly reset prompt state before navigation.
 *
 * Previously, handleCreateNew only called navigate() and relied on usePromptLoader's
 * async useEffect to reset state. This caused a visible flash of stale prompt and
 * generation state when clicking "+ New" from a populated session.
 *
 * Invariant: For any populated session, handleCreateNew must call setInputPrompt(''),
 * setOptimizedPrompt(''), and setDisplayedPrompt('') synchronously before navigate().
 * It must also dispatch a 'po:workspace-reset' event for generation controls.
 */

const buildPopulatedOptions = () => {
  const setInputPrompt = vi.fn();
  const setOptimizedPrompt = vi.fn();
  const setDisplayedPrompt = vi.fn();
  const navigate = vi.fn();
  const createDraft = vi.fn(() => ({ uuid: "uuid-new", id: "draft-new" }));

  return {
    options: {
      debug: {
        logAction: vi.fn(),
        logError: vi.fn(),
        startTimer: vi.fn(),
        endTimer: vi.fn(),
      } as any,
      navigate,
      promptOptimizer: {
        setDisplayedPrompt,
        setInputPrompt,
        setOptimizedPrompt,
        inputPrompt: "A cinematic dragon flying over mountains at sunset",
        optimizedPrompt:
          "An epic dragon soars over jagged mountain peaks as golden light bathes the scene",
        displayedPrompt:
          "An epic dragon soars over jagged mountain peaks as golden light bathes the scene",
      } as any,
      promptHistory: { createDraft },
      selectedMode: "video",
      selectedModel: "kling-1.6",
      generationParams: { duration: "5s", aspect_ratio: "16:9" },
      currentPromptUuid: "uuid-populated",
      currentPromptDocId: "draft-populated",
      promptContext: null,
      currentKeyframes: [],
      currentHighlightSnapshot: null,
      currentVersions: [],
      isApplyingHistoryRef: { current: false },
    },
    mocks: {
      setInputPrompt,
      setOptimizedPrompt,
      setDisplayedPrompt,
      navigate,
      createDraft,
    },
  };
};

describe("regression: handleCreateNew eagerly resets prompt state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears inputPrompt, optimizedPrompt, and displayedPrompt before navigate", () => {
    const { options, mocks } = buildPopulatedOptions();

    // Track call order to verify resets happen before navigate
    const callOrder: string[] = [];
    mocks.setInputPrompt.mockImplementation(() =>
      callOrder.push("setInputPrompt"),
    );
    mocks.setOptimizedPrompt.mockImplementation(() =>
      callOrder.push("setOptimizedPrompt"),
    );
    mocks.setDisplayedPrompt.mockImplementation(() =>
      callOrder.push("setDisplayedPrompt"),
    );
    mocks.navigate.mockImplementation(() => callOrder.push("navigate"));

    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.handleCreateNew();
    });

    // Prompt state must be cleared
    expect(mocks.setInputPrompt).toHaveBeenCalledWith("");
    expect(mocks.setOptimizedPrompt).toHaveBeenCalledWith("");
    expect(mocks.setDisplayedPrompt).toHaveBeenCalledWith("");

    // All resets must happen before navigate
    const navigateIndex = callOrder.indexOf("navigate");
    const inputResetIndex = callOrder.indexOf("setInputPrompt");
    const optimizedResetIndex = callOrder.indexOf("setOptimizedPrompt");
    const displayedResetIndex = callOrder.indexOf("setDisplayedPrompt");

    expect(inputResetIndex).toBeLessThan(navigateIndex);
    expect(optimizedResetIndex).toBeLessThan(navigateIndex);
    expect(displayedResetIndex).toBeLessThan(navigateIndex);
  });

  it("dispatches po:workspace-reset event for generation controls before navigate", () => {
    const { options, mocks } = buildPopulatedOptions();

    let resetEventFired = false;
    let navigateCalled = false;
    let resetBeforeNavigate = false;

    const handler = (): void => {
      resetEventFired = true;
      resetBeforeNavigate = !navigateCalled;
    };
    window.addEventListener("po:workspace-reset", handler);

    mocks.navigate.mockImplementation(() => {
      navigateCalled = true;
    });

    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.handleCreateNew();
    });

    window.removeEventListener("po:workspace-reset", handler);

    expect(resetEventFired).toBe(true);
    expect(resetBeforeNavigate).toBe(true);
  });

  it("still persists the current workspace before resetting", () => {
    const { options, mocks } = buildPopulatedOptions();

    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.handleCreateNew();
    });

    // First createDraft call persists the populated session
    expect(mocks.createDraft).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: "A cinematic dragon flying over mountains at sunset",
        output:
          "An epic dragon soars over jagged mountain peaks as golden light bathes the scene",
        persist: true,
      }),
    );

    // Second createDraft call creates the blank new draft
    expect(mocks.createDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "video",
        targetModel: "kling-1.6",
      }),
    );
  });
});
