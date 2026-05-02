import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import type {
  Generation,
  GenerationMediaType,
  GenerationTier,
} from "@features/generations/types";
import { selectHeroGeneration } from "../selectHeroGeneration";

// Regression: ISSUE-26
//
// Invariant: when a session contains both a completed render-tier video AND a
// completed draft-tier video (and no explicit override or active selection
// targets one of them), the hero canvas defaults to the render-tier generation.
//
// Background: users pay materially more credits for render-tier output (e.g.
// Sora 2 at 48 credits) versus a draft preview. The hero is the canvas-first
// surface — it must showcase the most valuable artifact in the session.

const buildGeneration = (overrides: Partial<Generation>): Generation => ({
  id: overrides.id ?? "gen-1",
  tier: overrides.tier ?? "draft",
  status: overrides.status ?? "completed",
  model: overrides.model ?? "stub-model",
  prompt: overrides.prompt ?? "stub prompt",
  promptVersionId: overrides.promptVersionId ?? "v-1",
  createdAt: overrides.createdAt ?? 0,
  completedAt: overrides.completedAt ?? null,
  mediaType: overrides.mediaType ?? "video",
  mediaUrls: overrides.mediaUrls ?? ["https://media.example/asset.mp4"],
  ...overrides,
});

describe("regression: hero generation prefers render over draft (ISSUE-26)", () => {
  it("returns render-tier generation when both tiers exist with no active/override id", () => {
    const draft = buildGeneration({
      id: "draft-1",
      tier: "draft",
      createdAt: 100,
    });
    const render = buildGeneration({
      id: "render-1",
      tier: "render",
      createdAt: 50, // older than the draft
    });

    // Even though `draft` is the most-recent generation, the render should win.
    const result = selectHeroGeneration({
      generations: [render, draft],
      activeGenerationId: null,
      heroOverrideGenerationId: null,
    });

    expect(result?.id).toBe("render-1");
  });

  it("still respects explicit override id even when it points to a draft", () => {
    const draft = buildGeneration({ id: "draft-1", tier: "draft" });
    const render = buildGeneration({ id: "render-1", tier: "render" });

    const result = selectHeroGeneration({
      generations: [render, draft],
      activeGenerationId: null,
      heroOverrideGenerationId: "draft-1",
    });

    expect(result?.id).toBe("draft-1");
  });

  it("still respects active selection even when it points to a draft", () => {
    const draft = buildGeneration({ id: "draft-1", tier: "draft" });
    const render = buildGeneration({ id: "render-1", tier: "render" });

    const result = selectHeroGeneration({
      generations: [render, draft],
      activeGenerationId: "draft-1",
      heroOverrideGenerationId: null,
    });

    expect(result?.id).toBe("draft-1");
  });

  it("never selects an image-sequence (storyboard) as hero", () => {
    const storyboard = buildGeneration({
      id: "storyboard-1",
      tier: "draft",
      mediaType: "image-sequence",
    });
    const render = buildGeneration({ id: "render-1", tier: "render" });

    const result = selectHeroGeneration({
      generations: [storyboard, render],
      activeGenerationId: "storyboard-1", // even when explicitly active
      heroOverrideGenerationId: "storyboard-1", // even with override
    });

    expect(result?.mediaType).not.toBe("image-sequence");
    expect(result?.id).toBe("render-1");
  });

  it("falls back to latest draft when no render-tier video exists", () => {
    const olderDraft = buildGeneration({
      id: "draft-old",
      tier: "draft",
      createdAt: 10,
    });
    const newerDraft = buildGeneration({
      id: "draft-new",
      tier: "draft",
      createdAt: 20,
    });

    const result = selectHeroGeneration({
      generations: [olderDraft, newerDraft],
      activeGenerationId: null,
      heroOverrideGenerationId: null,
    });

    expect(result?.id).toBe("draft-new");
  });

  it("returns null when only storyboards exist", () => {
    const storyboardA = buildGeneration({
      id: "sb-a",
      mediaType: "image-sequence",
    });
    const storyboardB = buildGeneration({
      id: "sb-b",
      mediaType: "image-sequence",
    });

    const result = selectHeroGeneration({
      generations: [storyboardA, storyboardB],
      activeGenerationId: null,
      heroOverrideGenerationId: null,
    });

    expect(result).toBeNull();
  });

  it("returns null for empty generation list", () => {
    expect(
      selectHeroGeneration({
        generations: [],
        activeGenerationId: null,
        heroOverrideGenerationId: null,
      }),
    ).toBeNull();
  });

  // Property test: across arbitrary mixes of generations, the default-selection
  // path (no override, no active) must never return a draft when at least one
  // non-storyboard render exists in the list.
  it("property: default selection prefers any render over any draft", () => {
    const tierArb = fc.constantFrom<GenerationTier>("draft", "render");
    const mediaTypeArb = fc.constantFrom<GenerationMediaType>(
      "video",
      "image",
      "image-sequence",
    );
    const generationArb = fc
      .tuple(fc.uuid(), tierArb, mediaTypeArb, fc.integer({ min: 0, max: 1e9 }))
      .map(([id, tier, mediaType, createdAt]) =>
        buildGeneration({ id, tier, mediaType, createdAt }),
      );

    fc.assert(
      fc.property(
        fc.array(generationArb, { minLength: 1, maxLength: 12 }),
        (generations) => {
          const result = selectHeroGeneration({
            generations,
            activeGenerationId: null,
            heroOverrideGenerationId: null,
          });

          const nonStoryboard = generations.filter(
            (g) => g.mediaType !== "image-sequence",
          );
          const hasRender = nonStoryboard.some((g) => g.tier === "render");

          if (nonStoryboard.length === 0) {
            return result === null;
          }
          if (hasRender) {
            return result !== null && result.tier === "render";
          }
          // No renders → result must be a non-storyboard draft.
          return (
            result !== null &&
            result.tier === "draft" &&
            result.mediaType !== "image-sequence"
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
