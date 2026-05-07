import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGenerationActions } from "../useGenerationActions";
import type { Generation } from "../../types";

const generateStoryboardPreviewMock = vi.fn();
const publishCreditBalanceSyncMock = vi.hoisted(() => vi.fn());
const requestCreditBalanceRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useUserCreditBalance", () => ({
  publishCreditBalanceSync: (...args: unknown[]) =>
    publishCreditBalanceSyncMock(...args),
  requestCreditBalanceRefresh: (...args: unknown[]) =>
    requestCreditBalanceRefreshMock(...args),
}));

vi.mock("../../api", () => ({
  compileWanPrompt: vi.fn(),
  generateVideoPreview: vi.fn(),
  generateStoryboardPreview: (...args: unknown[]) =>
    generateStoryboardPreviewMock(...args),
  waitForVideoJob: vi.fn(),
}));

const getActionsOfType = (
  dispatch: ReturnType<typeof vi.fn>,
  type: string,
): Array<{ type: string; payload?: unknown }> =>
  dispatch.mock.calls
    .map((call) => call[0] as { type: string; payload?: unknown })
    .filter((action) => action.type === type);

const baseStoryboardResponse = {
  success: true,
  data: {
    imageUrls: [
      "https://gcs.example/frame-1.png",
      "https://gcs.example/frame-2.png",
      "https://gcs.example/frame-3.png",
      "https://gcs.example/frame-4.png",
    ],
    storagePaths: [
      "users/u-1/preview-image/asset-1",
      "users/u-1/preview-image/asset-2",
      "users/u-1/preview-image/asset-3",
      "users/u-1/preview-image/asset-4",
    ],
    deltas: ["beat 1", "beat 2", "beat 3", "beat 4"],
    baseImageUrl: "https://gcs.example/frame-1.png",
  },
};

describe("useGenerationActions storyboard session-persist regression (ISSUE-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ISSUE-12 follow-up: ADD_GENERATION retired. All state growth flows
  // through SET_GENERATIONS over the current set. The distinguishing
  // signal for "server persisted" vs "legacy dispatch" is now the id on
  // the appended generation — server-persisted entries carry the server's
  // generationId, legacy entries carry a client-minted id.
  it("dispatches SET_GENERATIONS carrying the server's generationId when the server persisted", async () => {
    const dispatch = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue({
      ...baseStoryboardResponse,
      data: {
        ...baseStoryboardResponse.data,
        generationId: "server-gen-123",
      },
    });

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-1",
        promptVersionId: "v-1",
        generations: [],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut on mars", {
        promptVersionId: "v-1",
      });
    });

    await waitFor(() => {
      expect(generateStoryboardPreviewMock).toHaveBeenCalledTimes(1);
    });

    const setActions = getActionsOfType(dispatch, "SET_GENERATIONS");
    expect(setActions).toHaveLength(1);

    const payload = setActions[0]!.payload as Generation[];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      id: "server-gen-123",
      status: "completed",
      mediaUrls: baseStoryboardResponse.data.imageUrls,
    });
  });

  it("forwards sessionId + promptVersionId in the POST options", async () => {
    const dispatch = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue({
      ...baseStoryboardResponse,
      data: { ...baseStoryboardResponse.data, generationId: "server-gen-2" },
    });

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-42",
        promptVersionId: "v-7",
        generations: [],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut on mars", {
        promptVersionId: "v-7",
      });
    });

    await waitFor(() => {
      expect(generateStoryboardPreviewMock).toHaveBeenCalledTimes(1);
    });

    const [, postOptions] = generateStoryboardPreviewMock.mock.calls[0]!;
    expect(postOptions).toEqual(
      expect.objectContaining({
        sessionId: "session-42",
        promptVersionId: "v-7",
      }),
    );
  });

  it("omits sessionId from the POST when no sessionId is supplied (legacy draft mode) and still grows state via SET_GENERATIONS", async () => {
    const dispatch = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue(baseStoryboardResponse);

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        promptVersionId: "v-legacy",
        generations: [],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut on mars", {
        promptVersionId: "v-legacy",
      });
    });

    await waitFor(() => {
      expect(generateStoryboardPreviewMock).toHaveBeenCalledTimes(1);
    });

    const setActions = getActionsOfType(dispatch, "SET_GENERATIONS");
    // State still grows (legacy path uses acceptGeneration → SET_GENERATIONS
    // with a client-minted id); the distinguishing behaviour is that no
    // sessionId was forwarded to the server.
    expect(setActions.length).toBeGreaterThanOrEqual(1);

    const [, postOptions] = generateStoryboardPreviewMock.mock.calls[0]!;
    expect(postOptions).not.toHaveProperty("sessionId");
  });

  it("uses a client-minted id when server response omits generationId (persist soft-failed)", async () => {
    const dispatch = vi.fn();
    // Server returned 200 with media but did NOT persist (e.g., soft-fail path).
    generateStoryboardPreviewMock.mockResolvedValue(baseStoryboardResponse);

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-1",
        promptVersionId: "v-1",
        generations: [],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut on mars", {
        promptVersionId: "v-1",
      });
    });

    await waitFor(() => {
      expect(generateStoryboardPreviewMock).toHaveBeenCalledTimes(1);
    });

    const setActions = getActionsOfType(dispatch, "SET_GENERATIONS");
    expect(setActions.length).toBeGreaterThanOrEqual(1);

    // Without a server generationId, the appended generation carries a
    // client-minted id. This is the fallback we accept when persist
    // soft-fails; the media URLs still render.
    const lastPayload = setActions[setActions.length - 1]!
      .payload as Generation[];
    const appended = lastPayload[lastPayload.length - 1]!;
    expect(appended.id).toMatch(/^[^-]+/); // present, not empty
    expect(appended.id).not.toBe("server-gen-123");
  });

  it("preserves existing generations when appending via SET_GENERATIONS", async () => {
    const existingGen: Generation = {
      id: "existing-gen",
      tier: "draft",
      model: "flux-kontext",
      prompt: "prior",
      status: "completed",
      mediaUrls: ["https://prior.png"],
      createdAt: Date.now(),
      promptVersionId: "v-1",
    } as Generation;

    const dispatch = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue({
      ...baseStoryboardResponse,
      data: { ...baseStoryboardResponse.data, generationId: "new-gen" },
    });

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-1",
        promptVersionId: "v-1",
        generations: [existingGen],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut on mars", {
        promptVersionId: "v-1",
      });
    });

    await waitFor(() => {
      expect(generateStoryboardPreviewMock).toHaveBeenCalledTimes(1);
    });

    const setActions = getActionsOfType(dispatch, "SET_GENERATIONS");
    expect(setActions).toHaveLength(1);
    const payload = setActions[0]!.payload as Generation[];
    expect(payload).toHaveLength(2);
    expect(payload[0]!.id).toBe("existing-gen");
    expect(payload[1]!.id).toBe("new-gen");
  });
});
