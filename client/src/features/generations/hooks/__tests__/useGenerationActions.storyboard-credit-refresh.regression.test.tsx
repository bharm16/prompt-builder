/**
 * Regression: a successful storyboard preview MUST trigger a credit balance
 * refresh. The other generation paths (draft render at line 794, full render
 * at line 1332) call `syncCreditBalanceFromResponse(response.remainingCredits)`
 * after acceptGeneration. The storyboard path at line 970 was missing the
 * call — so users saw a stale credit balance for the entire session after
 * spending 4 credits on Preview-storyboard, until a larger transaction
 * (Generate) finally refreshed the badge.
 *
 * Invariants:
 *  (a) Storyboard success WITHOUT remainingCredits in response → refresh
 *      requested via `requestCreditBalanceRefresh()`.
 *  (b) Storyboard success WITH remainingCredits in response →
 *      `publishCreditBalanceSync(remainingCredits)` is called with the
 *      server-authoritative value.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGenerationActions } from "../useGenerationActions";

const generateStoryboardPreviewMock = vi.fn();
const publishCreditBalanceSyncMock = vi.hoisted(() => vi.fn());
const requestCreditBalanceRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useUserCreditBalance", () => ({
  publishCreditBalanceSync: publishCreditBalanceSyncMock,
  requestCreditBalanceRefresh: requestCreditBalanceRefreshMock,
}));

// Tightened from bare `vi.fn()` so that an accidental call to a mocked-but-
// unused API from the storyboard path (e.g. a future refactor that unifies
// code paths) fails loudly instead of resolving to undefined and slipping
// through the regression assertions. `vi.hoisted` runs the factory in the
// same pre-import pass that hoists `vi.mock`, so the function is available
// when the mock factory below is evaluated.
const failIfCalled = vi.hoisted(
  () => (label: string) =>
    vi.fn(() => {
      throw new Error(
        `Storyboard credit-refresh regression test should not call ${label}`,
      );
    }),
);

vi.mock("../../api", () => ({
  compileWanPrompt: failIfCalled("compileWanPrompt"),
  generateVideoPreview: failIfCalled("generateVideoPreview"),
  generateStoryboardPreview: (...args: unknown[]) =>
    generateStoryboardPreviewMock(...args),
  waitForVideoJob: failIfCalled("waitForVideoJob"),
}));

const buildSuccessResponse = (extras: { remainingCredits?: number } = {}) => ({
  success: true,
  data: {
    imageUrls: [
      "https://gcs.example/frame-1.png",
      "https://gcs.example/frame-2.png",
    ],
    storagePaths: ["users/u/preview-image/a1", "users/u/preview-image/a2"],
    deltas: ["b1", "b2"],
    baseImageUrl: "https://gcs.example/frame-1.png",
    generationId: "server-gen-xyz",
  },
  ...(typeof extras.remainingCredits === "number"
    ? { remainingCredits: extras.remainingCredits }
    : {}),
});

describe("regression: storyboard success refreshes credit balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls requestCreditBalanceRefresh when response has no remainingCredits", async () => {
    const dispatch = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue(buildSuccessResponse());

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-abc",
        promptVersionId: "v-1",
        generations: [],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut", {
        promptVersionId: "v-1",
      });
    });

    expect(requestCreditBalanceRefreshMock).toHaveBeenCalledTimes(1);
    expect(publishCreditBalanceSyncMock).not.toHaveBeenCalled();
  });

  it("calls publishCreditBalanceSync with the server-authoritative balance when remainingCredits is in the response", async () => {
    const dispatch = vi.fn();
    generateStoryboardPreviewMock.mockResolvedValue(
      buildSuccessResponse({ remainingCredits: 972 }),
    );

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, {
        sessionId: "session-abc",
        promptVersionId: "v-1",
        generations: [],
      }),
    );

    await act(async () => {
      await result.current.generateStoryboard("astronaut", {
        promptVersionId: "v-1",
      });
    });

    expect(publishCreditBalanceSyncMock).toHaveBeenCalledTimes(1);
    expect(publishCreditBalanceSyncMock).toHaveBeenCalledWith(972);
    expect(requestCreditBalanceRefreshMock).not.toHaveBeenCalled();
  });
});
