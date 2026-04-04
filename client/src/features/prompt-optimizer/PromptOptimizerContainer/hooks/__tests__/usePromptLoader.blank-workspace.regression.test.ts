/**
 * Regression test: Entering `/` without a session ID must clear stale state.
 *
 * Previously, navigating from `/home` to `/` would preserve the last-loaded
 * session's prompt and generation state because usePromptLoader early-returned
 * without resetting anything when sessionId was undefined.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePromptLoader } from "../usePromptLoader";

const mockGetById = vi.hoisted(() => vi.fn());
vi.mock("@repositories/index", () => ({
  getPromptRepositoryForUser: vi.fn(() => ({ getById: mockGetById })),
}));

type LoaderOverrides = Partial<Parameters<typeof usePromptLoader>[0]>;

const buildParams = (overrides: LoaderOverrides = {}) => ({
  sessionId: null,
  navigate: vi.fn(),
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
  user: { uid: "user-1" },
  historyEntries: [],
  createDraftEntry: vi.fn(() => ({ uuid: "draft-uuid", id: "draft-123" })),
  selectedMode: "video",
  selectedModelValue: "model-a",
  generationParamsValue: {},
  promptOptimizer: {
    displayedPrompt: "",
    setInputPrompt: vi.fn(),
    setOptimizedPrompt: vi.fn(),
    setDisplayedPrompt: vi.fn(),
    setGenericOptimizedPrompt: vi.fn(),
    setPreviewPrompt: vi.fn(),
    setPreviewAspectRatio: vi.fn(),
  },
  setDisplayedPromptSilently: vi.fn(),
  applyInitialHighlightSnapshot: vi.fn(),
  resetEditStacks: vi.fn(),
  resetVersionEdits: vi.fn(),
  setCurrentPromptDocId: vi.fn(),
  setCurrentPromptUuid: vi.fn(),
  setShowResults: vi.fn(),
  setSelectedMode: vi.fn(),
  setSelectedModel: vi.fn(),
  setGenerationParams: vi.fn(),
  upsertHistoryEntry: vi.fn(),
  setSuggestionsData: vi.fn(),
  setConceptElements: vi.fn(),
  setPromptContext: vi.fn(),
  onLoadKeyframes: vi.fn(),
  skipLoadFromUrlRef: { current: false },
  ...overrides,
});

describe("regression: blank workspace when sessionId is null", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears prompt state when entering / without a session", async () => {
    const params = buildParams({ sessionId: null });

    renderHook(() =>
      usePromptLoader(params as Parameters<typeof usePromptLoader>[0]),
    );

    await waitFor(() => {
      expect(params.promptOptimizer.setInputPrompt).toHaveBeenCalledWith("");
      expect(params.promptOptimizer.setOptimizedPrompt).toHaveBeenCalledWith(
        "",
      );
      expect(params.setDisplayedPromptSilently).toHaveBeenCalledWith("");
      expect(params.setSuggestionsData).toHaveBeenCalledWith(null);
      expect(params.setShowResults).toHaveBeenCalledWith(false);
    });
  });

  it("dispatches po:workspace-reset to clear generation state", async () => {
    const params = buildParams({ sessionId: null });
    const handler = vi.fn();
    window.addEventListener("po:workspace-reset", handler);

    renderHook(() =>
      usePromptLoader(params as Parameters<typeof usePromptLoader>[0]),
    );

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    window.removeEventListener("po:workspace-reset", handler);
  });
});
