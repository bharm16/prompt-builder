/**
 * Regression: when the storyboard POST returns a server-persisted
 * generationId, useGenerationActions MUST invoke the caller's
 * `onServerGenerationPersisted` callback so the workspace can re-fetch
 * the session and hydrate the gallery without requiring a page reload.
 *
 * Invariants:
 *  (a) Storyboard success WITH generationId → callback called once with
 *      { sessionId, generationId }.
 *  (b) Storyboard success WITHOUT generationId (legacy client-authoritative
 *      path) → callback NOT called — there is nothing server-side for the
 *      caller to re-fetch.
 *  (c) Storyboard failure → callback NOT called.
 *
 * Bug captured: after ISSUE-12 landed server-side persistence, the
 * storyboard image rendered only on page reload. The client-side
 * `acceptGeneration` dispatch populated the local reducer with a stale
 * server id but never triggered a history re-fetch, so the gallery's
 * `galleryEntries` chain (which depends on version-record generations)
 * stayed empty. Users saw an empty gallery right after paying for a
 * render, even though the server had the result.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGenerationActions } from "../useGenerationActions";

const generateStoryboardPreviewMock = vi.fn();

vi.mock("@/hooks/useUserCreditBalance", () => ({
  publishCreditBalanceSync: vi.fn(),
  requestCreditBalanceRefresh: vi.fn(),
}));

vi.mock("../../api", () => ({
  compileWanPrompt: vi.fn(),
  generateVideoPreview: vi.fn(),
  generateStoryboardPreview: (...args: unknown[]) =>
    generateStoryboardPreviewMock(...args),
  waitForVideoJob: vi.fn(),
}));

const successResponse = (generationId?: string) => ({
  success: true,
  data: {
    imageUrls: [
      "https://gcs.example/frame-1.png",
      "https://gcs.example/frame-2.png",
      "https://gcs.example/frame-3.png",
      "https://gcs.example/frame-4.png",
    ],
    storagePaths: [
      "users/u/preview-image/a1",
      "users/u/preview-image/a2",
      "users/u/preview-image/a3",
      "users/u/preview-image/a4",
    ],
    deltas: ["b1", "b2", "b3", "b4"],
    baseImageUrl: "https://gcs.example/frame-1.png",
    ...(generationId ? { generationId } : {}),
  },
});

describe("regression: storyboard success triggers onServerGenerationPersisted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires the callback with sessionId + generationId when server persisted", async () => {
    const dispatch = vi.fn();
    const onServerGenerationPersisted = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue(
      successResponse("server-gen-xyz"),
    );

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-abc",
        promptVersionId: "v-1",
        generations: [],
        onServerGenerationPersisted,
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut", {
        promptVersionId: "v-1",
      });
    });

    await waitFor(() => {
      expect(onServerGenerationPersisted).toHaveBeenCalledTimes(1);
    });
    expect(onServerGenerationPersisted).toHaveBeenCalledWith({
      sessionId: "session-abc",
      generationId: "server-gen-xyz",
    });
  });

  it("does NOT fire the callback when the server did not persist (no generationId)", async () => {
    const dispatch = vi.fn();
    const onServerGenerationPersisted = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue(successResponse());

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-abc",
        promptVersionId: "v-1",
        generations: [],
        onServerGenerationPersisted,
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut", {
        promptVersionId: "v-1",
      });
    });

    expect(onServerGenerationPersisted).not.toHaveBeenCalled();
  });

  it("does NOT fire the callback on error responses", async () => {
    const dispatch = vi.fn();
    const onServerGenerationPersisted = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue({
      success: false,
      error: "network failure",
    });

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-abc",
        promptVersionId: "v-1",
        generations: [],
        onServerGenerationPersisted,
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut", {
        promptVersionId: "v-1",
      });
    });

    expect(onServerGenerationPersisted).not.toHaveBeenCalled();
  });
});
