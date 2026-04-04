import { describe, expect, it } from "vitest";

import { ApiError } from "../../ApiClient";
import {
  buildOfflineResult,
  isAbortError,
  shouldUseOfflineFallback,
} from "../offlineFallback";

describe("shouldUseOfflineFallback", () => {
  it("returns true for auth failures", () => {
    expect(shouldUseOfflineFallback(new ApiError("Unauthorized", 401))).toBe(
      true,
    );
    expect(
      shouldUseOfflineFallback(
        Object.assign(new Error("Forbidden"), { status: 403 }),
      ),
    ).toBe(true);
  });

  it("returns false for non-auth failures", () => {
    expect(shouldUseOfflineFallback(new Error("Network timeout"))).toBe(false);
    expect(
      shouldUseOfflineFallback(
        Object.assign(new Error("Boom"), { status: 500 }),
      ),
    ).toBe(false);
  });
});

describe("isAbortError", () => {
  it("detects abort-like errors", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError({ code: "ABORT_ERR" })).toBe(true);
    expect(isAbortError(new Error("timeout"))).toBe(false);
  });
});

describe("buildOfflineResult", () => {
  it("returns a JSON optimize result with fallback metadata", () => {
    const result = buildOfflineResult(
      { prompt: "A cinematic scene", mode: "video-prompt" },
      new Error("401"),
    );

    expect(result.prompt).toContain("Offline Prompt Assistant");
    expect(result.prompt).toContain("A cinematic scene");
    expect(result.optimizedPrompt).toContain("Offline Prompt Assistant");
    expect(result.metadata).toEqual(
      expect.objectContaining({
        usedFallback: true,
        offline: true,
        reason: "unauthorized",
      }),
    );
  });

  it("handles empty prompts gracefully", () => {
    const result = buildOfflineResult({ prompt: "", mode: "optimize" }, null);
    expect(result.prompt).toContain("No original prompt was provided.");
    expect(result.metadata).toEqual(
      expect.objectContaining({ errorMessage: null }),
    );
  });
});
