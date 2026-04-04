import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useHighlightSourceSelection } from "@features/span-highlighting/hooks/useHighlightSourceSelection";
import { createHighlightSignature } from "@features/span-highlighting/hooks/useSpanLabeling";
import type { HighlightSnapshot } from "@features/prompt-optimizer/PromptCanvas/types";

vi.mock("@features/span-highlighting/hooks/useSpanLabeling", () => ({
  createHighlightSignature: vi.fn(() => "sig-generated"),
}));

const mockCreateHighlightSignature = vi.mocked(createHighlightSignature);

describe("useHighlightSourceSelection", () => {
  it("returns null when ML highlighting is disabled", () => {
    const { result } = renderHook(() =>
      useHighlightSourceSelection({
        initialHighlights: null,
        promptUuid: null,
        displayedPrompt: "Hello",
        enableMLHighlighting: false,
        initialHighlightsVersion: 0,
      }),
    );

    expect(result.current).toBeNull();
  });

  it("uses persisted local updates first", () => {
    const initialHighlights: HighlightSnapshot = {
      spans: [{ start: 0, end: 4, category: "subject", confidence: 0.9 }],
      meta: { localUpdate: true },
    };

    const { result } = renderHook(() =>
      useHighlightSourceSelection({
        initialHighlights,
        promptUuid: "uuid-1",
        displayedPrompt: "Snap",
        enableMLHighlighting: true,
        initialHighlightsVersion: 1,
      }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        source: "persisted",
        cacheId: "uuid-1",
        signature: "sig-generated",
      }),
    );
    expect(mockCreateHighlightSignature).toHaveBeenCalledWith("Snap");
  });

  it("falls back to persisted highlights when no local update flag exists", () => {
    const initialHighlights: HighlightSnapshot = {
      spans: [{ start: 0, end: 5, category: "style", confidence: 0.8 }],
      signature: "sig-1",
      cacheId: "cache-1",
    };

    const { result } = renderHook(() =>
      useHighlightSourceSelection({
        initialHighlights,
        promptUuid: "uuid-2",
        displayedPrompt: "Refined text",
        enableMLHighlighting: true,
        initialHighlightsVersion: 0,
      }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        source: "persisted",
        signature: "sig-1",
        cacheId: "cache-1",
      }),
    );
  });
});
