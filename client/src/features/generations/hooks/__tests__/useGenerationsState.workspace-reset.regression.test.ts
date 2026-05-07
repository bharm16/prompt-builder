/**
 * Regression test: New draft leaks previous session generation state.
 *
 * When clicking "+ New" to create a draft, the po:workspace-reset event must
 * clear generation jobs/media from useGenerationsState. Previously, the
 * generations array persisted across session transitions because the reset
 * event only cleared generation *controls* (start frame, keyframes, etc.)
 * but not the generation *jobs* themselves.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Generation } from "@features/generations/types";
import { useGenerationsState } from "../useGenerationsState";

const buildGeneration = (
  id: string,
  status: Generation["status"] = "pending",
): Generation => ({
  id,
  tier: "draft",
  status,
  model: "sora-2",
  prompt: `prompt-${id}`,
  promptVersionId: "v1",
  createdAt: Date.now(),
  completedAt: status === "completed" ? Date.now() : null,
  mediaType: "video",
  mediaUrls: [],
  thumbnailUrl: null,
});

describe("useGenerationsState clearGenerations", () => {
  it("clearGenerations empties the generations array and resets derived state", () => {
    const { result } = renderHook(() => useGenerationsState());

    // ISSUE-12 follow-up: seed state via SET_GENERATIONS with the full
    // authoritative set rather than two addGeneration calls. Under the
    // post-ADD_GENERATION architecture, "state grows" is a state-replace
    // from a known-good set — test setup should mirror that.
    act(() => {
      result.current.dispatch({
        type: "SET_GENERATIONS",
        payload: [
          buildGeneration("g1", "pending"),
          buildGeneration("g2", "generating"),
        ],
      });
    });

    expect(result.current.generations).toHaveLength(2);
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.activeGenerationId).toBe("g2");

    // Clear — simulates what happens on po:workspace-reset
    act(() => {
      result.current.clearGenerations();
    });

    expect(result.current.generations).toHaveLength(0);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.activeGenerationId).toBeNull();
  });
});
