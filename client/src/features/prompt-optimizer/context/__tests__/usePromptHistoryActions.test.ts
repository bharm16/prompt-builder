import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PromptHistoryEntry } from "../types";
import { usePromptHistoryActions } from "../usePromptHistoryActions";

const buildOptions = (
  overrides: Partial<Parameters<typeof usePromptHistoryActions>[0]> = {},
) => {
  const navigate = vi.fn();
  const createDraft = vi.fn(() => ({ uuid: "uuid-draft", id: "draft-123" }));

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
        setDisplayedPrompt: vi.fn(),
        setInputPrompt: vi.fn(),
        setOptimizedPrompt: vi.fn(),
        inputPrompt: "",
        optimizedPrompt: "",
        displayedPrompt: "",
      } as any,
      promptHistory: {
        createDraft,
      },
      selectedMode: "video",
      selectedModel: "model-a",
      generationParams: {},
      currentPromptUuid: null,
      currentPromptDocId: null,
      promptContext: null,
      currentKeyframes: [],
      currentHighlightSnapshot: null,
      currentVersions: [],
      isApplyingHistoryRef: { current: false },
      ...overrides,
    },
    mocks: {
      navigate,
      createDraft,
    },
  };
};

describe("usePromptHistoryActions draft routing", () => {
  it("navigates new drafts to /session/draft-* and preserves meaningful unsaved state first", () => {
    const { options, mocks } = buildOptions({
      promptOptimizer: {
        setDisplayedPrompt: vi.fn(),
        setInputPrompt: vi.fn(),
        setOptimizedPrompt: vi.fn(),
        inputPrompt: "A cinematic alley at dawn",
        optimizedPrompt: "",
        displayedPrompt: "",
      } as any,
    });
    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.handleCreateNew();
    });

    expect(mocks.createDraft).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: "A cinematic alley at dawn",
        output: "",
        persist: true,
      }),
    );
    expect(mocks.createDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "video",
        targetModel: "model-a",
        generationParams: {},
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/session/draft-123", {
      replace: true,
    });
  });

  it("routes draft history entries to /session/draft-*", () => {
    const { options, mocks } = buildOptions();
    const { result } = renderHook(() => usePromptHistoryActions(options));

    const draftEntry = {
      id: "draft-999",
      uuid: "uuid-draft",
      input: "prompt",
      output: "",
      mode: "video",
      generationParams: {},
      keyframes: [],
      highlightCache: null,
      brainstormContext: null,
      versions: [],
    } as unknown as PromptHistoryEntry;

    act(() => {
      result.current.loadFromHistory(draftEntry);
    });

    expect(mocks.navigate).toHaveBeenCalledWith("/session/draft-999", {
      replace: true,
    });
  });

  it("persists a meaningful local workspace before navigating to another session", () => {
    const { options, mocks } = buildOptions({
      currentPromptUuid: "uuid-current",
      currentPromptDocId: "draft-current",
      promptOptimizer: {
        setDisplayedPrompt: vi.fn(),
        setInputPrompt: vi.fn(),
        setOptimizedPrompt: vi.fn(),
        inputPrompt: "",
        optimizedPrompt: "",
        displayedPrompt: "",
      } as any,
      currentKeyframes: [{ id: "kf-1", url: "https://example.com/frame.png" }],
      currentVersions: [
        {
          versionId: "v1",
          signature: "sig-1",
          prompt: "prompt",
          timestamp: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.loadFromHistory({
        id: "session-123",
        uuid: "uuid-target",
        input: "remote input",
        output: "remote output",
        mode: "video",
      } as PromptHistoryEntry);
    });

    expect(mocks.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "draft-current",
        uuid: "uuid-current",
        keyframes: [{ id: "kf-1", url: "https://example.com/frame.png" }],
        versions: [
          expect.objectContaining({
            versionId: "v1",
            signature: "sig-1",
          }),
        ],
        persist: true,
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/session/session-123", {
      replace: true,
    });
  });
});
