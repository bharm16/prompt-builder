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

  it("uses a single space (not double comma) when prompt already ends with a comma", () => {
    // Locks the trailing-comma branch: separator collapses to " " when the
    // prompt already ends in "," so we don't render "a dancer,, handheld".
    const handheld = TUNE_CHIPS.find((c) => c.id === "m-handheld");
    expect(handheld).toBeDefined();
    const result = applyTuneChips("a dancer,", [handheld!.id]);
    expect(result).toBe("a dancer, handheld camera");
  });

  it("preserves the trailing-comma collapse after trimming whitespace", () => {
    // trimEnd() should run before the comma check — "a dancer,   " still
    // qualifies as comma-terminated.
    const handheld = TUNE_CHIPS.find((c) => c.id === "m-handheld");
    const result = applyTuneChips("a dancer,   ", [handheld!.id]);
    expect(result).toBe("a dancer, handheld camera");
  });

  it("ignores unknown chip ids without throwing", () => {
    // Defensive: a stale chip id from persisted state shouldn't crash the
    // generator. The function filters out unknowns silently.
    const result = applyTuneChips("a dancer", ["does-not-exist" as TuneChipId]);
    expect(result).toBe("a dancer");
  });
});
