import { describe, expect, it, vi } from "vitest";

import { applyIntentLockPolicy } from "../intentLockPolicy";

describe("applyIntentLockPolicy", () => {
  it("preserves model-compiled prompt structure when intent lock requests a repair", () => {
    const compiledPrompt =
      "Shot 1: A cyclist pushes off into the frame. Shot 2: The camera tracks behind as rain sprays from the tires.";
    const intentLock = {
      enforceIntentLock: vi.fn(() => ({
        prompt:
          "A repaired single-sentence prompt that drops temporal sequencing.",
        passed: true,
        repaired: true,
        required: { subject: "cyclist", action: "pushes off" },
      })),
    };

    const result = applyIntentLockPolicy({
      intentLock,
      originalPrompt: "A cyclist pushes off into the frame",
      optimizedPrompt: compiledPrompt,
      shotPlan: null,
      compilation: {
        status: "compiled",
        usedFallback: false,
        sourceKind: "artifact",
        structuredArtifactReused: true,
        analyzerBypassed: true,
        compiledFor: "sora-2",
      },
    });

    expect(result.prompt).toBe(compiledPrompt);
    expect(result.legacyMetadata.intentLockPassed).toBe(false);
    expect(result.compilationIntentLock).toMatchObject({
      skippedRepair: true,
      repaired: false,
      required: { subject: "cyclist", action: "pushes off" },
    });
  });

  it("preserves model-compiled prompt structure when intent lock throws", () => {
    const compiledPrompt =
      "@CharacterA walks into frame. Audio: rain on metal roof. Camera: medium tracking shot.";
    const intentLock = {
      enforceIntentLock: vi.fn(() => {
        throw new Error(
          "Intent lock failed: optimized prompt does not preserve required subject/action semantics",
        );
      }),
    };

    const result = applyIntentLockPolicy({
      intentLock,
      originalPrompt: "Character A walks into frame under a metal roof",
      optimizedPrompt: compiledPrompt,
      shotPlan: null,
      compilation: {
        status: "compiled",
        usedFallback: false,
        sourceKind: "artifact",
        structuredArtifactReused: true,
        analyzerBypassed: true,
        compiledFor: "kling-2.1",
      },
    });

    expect(result.prompt).toBe(compiledPrompt);
    expect(result.legacyMetadata.intentLockPassed).toBe(false);
    expect(result.compilationIntentLock?.warning).toContain(
      "Intent lock failed",
    );
    expect(result.compilationIntentLock?.skippedRepair).toBe(true);
  });
});
