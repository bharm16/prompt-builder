import { describe, expect, it } from "vitest";

import {
  convertHighlightSnapshotToSourceSelectionOptions,
  isValidSpan,
} from "@features/prompt-optimizer/PromptCanvas/utils/spanDataConversion";
import type { HighlightSnapshot } from "@features/prompt-optimizer/PromptCanvas/types";

describe("spanDataConversion", () => {
  it("validates spans with required fields", () => {
    expect(
      isValidSpan({ start: 0, end: 2, category: "style", confidence: 0.5 }),
    ).toBe(true);
    expect(isValidSpan({ start: 0, end: 2, category: "style" })).toBe(false);
  });

  it("converts highlight snapshot to source selection options", () => {
    const snapshot: HighlightSnapshot = {
      spans: [{ start: 0, end: 2, category: "style", confidence: 0.5 }],
      meta: { source: "cache" },
      signature: "sig",
      cacheId: "cache-1",
    };

    const options = convertHighlightSnapshotToSourceSelectionOptions(snapshot);
    expect(options).toEqual({
      spans: [{ start: 0, end: 2, category: "style", confidence: 0.5 }],
      meta: { source: "cache" },
      signature: "sig",
      cacheId: "cache-1",
    });
  });
});
