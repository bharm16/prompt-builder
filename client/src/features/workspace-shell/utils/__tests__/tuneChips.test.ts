import { describe, expect, it } from "vitest";
import { TUNE_CHIPS, applyTuneChips, type TuneChipId } from "../tuneChips";

describe("tuneChips", () => {
  it("exposes 3 sections (Motion / Mood / Style)", () => {
    const sections = new Set(TUNE_CHIPS.map((c) => c.section));
    expect(sections.has("motion")).toBe(true);
    expect(sections.has("mood")).toBe(true);
    expect(sections.has("style")).toBe(true);
  });

  it("appends selected chip suffixes to the prompt, comma-separated", () => {
    const ids: TuneChipId[] = TUNE_CHIPS.slice(0, 2).map((c) => c.id);
    const result = applyTuneChips("a dancer", ids);
    expect(result.startsWith("a dancer, ")).toBe(true);
  });

  it("returns the prompt unchanged when no chips selected", () => {
    expect(applyTuneChips("a dancer", [])).toBe("a dancer");
  });
});
