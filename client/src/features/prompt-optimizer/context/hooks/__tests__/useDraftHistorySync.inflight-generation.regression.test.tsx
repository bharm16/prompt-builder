import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftHistorySync } from "../useDraftHistorySync";

const createPendingGeneration = () => ({
  id: "gen-1",
  tier: "render" as const,
  status: "generating" as const,
  model: "sora-2",
  prompt: "Original prompt",
  promptVersionId: "version-1",
  createdAt: Date.now(),
  completedAt: null,
  mediaType: "video" as const,
  mediaUrls: [],
});

describe("regression: useDraftHistorySync preserves in-flight draft identity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not overwrite a draft entry while one of its generations is still in flight", () => {
    const updateEntryPersisted = vi.fn();

    renderHook(() =>
      useDraftHistorySync({
        currentPromptUuid: "uuid-1",
        currentPromptDocId: "draft-1",
        promptHistory: {
          history: [
            {
              uuid: "uuid-1",
              id: "draft-1",
              input: "Original prompt",
              output: "",
              targetModel: "sora-2",
              generationParams: { duration_s: 4 },
              versions: [
                {
                  versionId: "version-1",
                  signature: "sig-1",
                  prompt: "Original prompt",
                  timestamp: "2026-03-24T00:00:00.000Z",
                  generations: [createPendingGeneration()],
                },
              ],
            },
          ],
          updateEntryPersisted,
        } as any,
        promptOptimizer: {
          inputPrompt: "Edited prompt while queued",
        } as any,
        selectedModel: "sora-2",
        generationParams: { duration_s: 4 },
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(updateEntryPersisted).not.toHaveBeenCalled();
  });

  it("still persists normal draft edits when no generations are in flight", () => {
    const updateEntryPersisted = vi.fn();

    renderHook(() =>
      useDraftHistorySync({
        currentPromptUuid: "uuid-1",
        currentPromptDocId: "draft-1",
        promptHistory: {
          history: [
            {
              uuid: "uuid-1",
              id: "draft-1",
              input: "Original prompt",
              output: "",
              targetModel: "sora-2",
              generationParams: { duration_s: 4 },
              versions: [
                {
                  versionId: "version-1",
                  signature: "sig-1",
                  prompt: "Original prompt",
                  timestamp: "2026-03-24T00:00:00.000Z",
                  generations: [
                    {
                      ...createPendingGeneration(),
                      status: "completed" as const,
                      completedAt: Date.now(),
                    },
                  ],
                },
              ],
            },
          ],
          updateEntryPersisted,
        } as any,
        promptOptimizer: {
          inputPrompt: "Edited prompt after completion",
        } as any,
        selectedModel: "sora-2",
        generationParams: { duration_s: 4 },
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(updateEntryPersisted).toHaveBeenCalledWith("uuid-1", "draft-1", {
      input: "Edited prompt after completion",
      targetModel: "sora-2",
      generationParams: { duration_s: 4 },
    });
  });
});
