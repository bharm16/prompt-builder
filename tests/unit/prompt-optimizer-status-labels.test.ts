import { describe, expect, it } from "vitest";

import { resolveActiveStatusLabel } from "@features/prompt-optimizer/utils/activeStatusLabel";

const baseParams = {
  inputPrompt: "",
  displayedPrompt: "",
  isProcessing: false,
  hasHighlights: false,
};

describe("resolveActiveStatusLabel", () => {
  it("returns Optimizing while processing", () => {
    expect(
      resolveActiveStatusLabel({
        ...baseParams,
        isProcessing: true,
        displayedPrompt: "out",
      }),
    ).toBe("Optimizing");
  });

  it("returns Draft when there is no generated output", () => {
    expect(resolveActiveStatusLabel(baseParams)).toBe("Draft");
    expect(
      resolveActiveStatusLabel({ ...baseParams, inputPrompt: "input" }),
    ).toBe("Draft");
  });

  it("distinguishes Generated vs Optimized based on highlights", () => {
    expect(
      resolveActiveStatusLabel({
        ...baseParams,
        displayedPrompt: "out",
        hasHighlights: true,
      }),
    ).toBe("Generated");
    expect(
      resolveActiveStatusLabel({
        ...baseParams,
        displayedPrompt: "out",
        hasHighlights: false,
      }),
    ).toBe("Optimized");
  });
});
