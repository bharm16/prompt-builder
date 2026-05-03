import { describe, expect, it } from "vitest";
import type { PromptVersionEntry } from "@features/prompt-optimizer/types/domain/prompt-session";
import { computeIsEmptySession } from "../computeIsEmptySession";

// Regression: ISSUE-35
//
// Invariant: navigating to an existing session that has at least one saved
// prompt version must NOT render the empty-state chrome (NewSessionView)
// over the canvas. The previous predicate gated the "session has a prompt"
// check on `enableMLHighlighting` (which is false until `showResults`
// flips), so during session hydration the empty-state copy briefly
// overlapped a fully populated prompt.

const buildVersion = (
  overrides: Partial<PromptVersionEntry> = {},
): PromptVersionEntry => ({
  versionId: "v-1",
  label: "v1",
  signature: "sig",
  prompt: "samurai meditates",
  timestamp: "2026-04-29T12:00:00.000Z",
  ...overrides,
});

const baseInput = {
  galleryEntriesCount: 0,
  hasHeroGeneration: false,
  hasStartFrame: false,
  prompt: "",
  enableMLHighlighting: false,
  versions: [] as ReadonlyArray<PromptVersionEntry>,
};

describe("regression: empty-state chrome stays hidden for hydrated sessions (ISSUE-35)", () => {
  it("returns false when versions exist and the prompt is non-empty, even with enableMLHighlighting=false", () => {
    // Live repro: session loads, prompt hydrates from server, showResults
    // hasn't flipped yet → enableMLHighlighting is false → bug.
    const result = computeIsEmptySession({
      ...baseInput,
      prompt: "Establishing Shot of a meditating samurai",
      enableMLHighlighting: false,
      versions: [buildVersion()],
    });
    expect(result).toBe(false);
  });

  it("returns true for a brand-new draft (typing in the prompt bar) — no versions yet", () => {
    // The other side of the invariant: when the user is typing into a fresh
    // draft, there's no persisted version and the empty-state chrome should
    // still show until they commit (optimize → save). The predicate must
    // not over-correct and hide the welcome chrome for genuine first-use.
    const result = computeIsEmptySession({
      ...baseInput,
      prompt: "samurai",
      enableMLHighlighting: false,
      versions: [],
    });
    expect(result).toBe(true);
  });

  it("returns false when results view is active and prompt is non-empty (existing behavior)", () => {
    const result = computeIsEmptySession({
      ...baseInput,
      prompt: "samurai meditates",
      enableMLHighlighting: true,
      versions: [],
    });
    expect(result).toBe(false);
  });

  it("returns false when generations exist", () => {
    const result = computeIsEmptySession({
      ...baseInput,
      galleryEntriesCount: 2,
    });
    expect(result).toBe(false);
  });

  it("returns false when a hero generation is selected", () => {
    const result = computeIsEmptySession({
      ...baseInput,
      hasHeroGeneration: true,
    });
    expect(result).toBe(false);
  });

  it("returns false when a start frame has been dropped on the canvas", () => {
    const result = computeIsEmptySession({
      ...baseInput,
      hasStartFrame: true,
    });
    expect(result).toBe(false);
  });

  it("returns true for a truly empty workspace (no prompt, no versions, no generations)", () => {
    const result = computeIsEmptySession({ ...baseInput });
    expect(result).toBe(true);
  });

  it("returns true when versions exist but the prompt is whitespace-only", () => {
    // Guards against a corrupt session where versions array somehow exists
    // but the prompt was wiped. Without the prompt-presence check we'd hide
    // the empty chrome on a literally-blank canvas.
    const result = computeIsEmptySession({
      ...baseInput,
      prompt: "   ",
      versions: [buildVersion()],
    });
    expect(result).toBe(true);
  });

  it("returns true when versions exist but the prompt is the empty string", () => {
    // Inverse-invariant lock for ISSUE-35: prompt is the *required* signal,
    // versions are *additive*. A future change that flipped the predicate to
    // treat `versions.length > 0` as the sole non-empty signal (dropping the
    // prompt check) would silently pass the prior tests, but break here —
    // it would hide the empty-state chrome on a truly-blank canvas during a
    // not-yet-hydrated load where versions arrive before prompt text.
    const result = computeIsEmptySession({
      ...baseInput,
      prompt: "",
      versions: [buildVersion()],
    });
    expect(result).toBe(true);
  });
});
