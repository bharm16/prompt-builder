/**
 * Regression: buildGeneration estimatedCost uses dynamic per-second pricing.
 *
 * Invariant: For any video generation, the estimatedCost on the Generation object
 * must reflect Math.ceil(creditsPerSecond × duration) when a per-second rate exists,
 * not a stale static value.
 *
 * Root cause: buildGeneration used getModelConfig(model).credits which returned stale
 * static values (Sora=80, Wan 2.5=5) instead of computing from creditsPerSecond × duration.
 */
import { describe, expect, it } from "vitest";
import { buildGeneration } from "../generationUtils";

describe("regression: buildGeneration estimatedCost uses dynamic pricing", () => {
  it("Sora generation at 4s duration has estimatedCost of ceil(6 × 4) = 24, not 80", () => {
    const generation = buildGeneration("render", "sora-2", "test prompt", {
      promptVersionId: "v1",
      aspectRatio: "16:9",
      duration: 4,
      fps: null,
      startImage: null,
      endImage: null,
      extendVideoUrl: null,
      characterAssetId: null,
      faceSwapUrl: null,
    });
    expect(generation.estimatedCost).toBe(Math.ceil(6 * 4));
  });

  it("Wan 2.5 draft at 5s duration has estimatedCost of ceil(3.5 × 5) = 18, not 5", () => {
    const generation = buildGeneration("draft", "wan-2.5", "test prompt", {
      promptVersionId: "v1",
      aspectRatio: "16:9",
      duration: 5,
      fps: null,
      startImage: null,
      endImage: null,
      extendVideoUrl: null,
      characterAssetId: null,
      faceSwapUrl: null,
    });
    expect(generation.estimatedCost).toBe(Math.ceil(3.5 * 5));
  });

  it("Sora at default 8s has estimatedCost of 48", () => {
    const generation = buildGeneration("render", "sora-2", "test prompt", {
      promptVersionId: "v1",
      aspectRatio: "16:9",
      duration: null,
      fps: null,
      startImage: null,
      endImage: null,
      extendVideoUrl: null,
      characterAssetId: null,
      faceSwapUrl: null,
    });
    expect(generation.estimatedCost).toBe(48);
  });

  it("flux-kontext (flat rate) has estimatedCost of 4 regardless of duration", () => {
    const generation = buildGeneration("draft", "flux-kontext", "test prompt", {
      promptVersionId: "v1",
      aspectRatio: "1:1",
      duration: 8,
      fps: null,
      startImage: null,
      endImage: null,
      extendVideoUrl: null,
      characterAssetId: null,
      faceSwapUrl: null,
    });
    expect(generation.estimatedCost).toBe(4);
  });
});
