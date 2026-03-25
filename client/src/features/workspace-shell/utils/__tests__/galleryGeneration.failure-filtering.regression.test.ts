import { describe, expect, it } from "vitest";

import { buildGalleryGenerationEntries } from "../galleryGeneration";
import type { Generation } from "@features/generations/types";

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: "gen-1",
  tier: "render",
  status: "completed",
  model: "sora",
  prompt: "Prompt",
  promptVersionId: "version-1",
  createdAt: 1000,
  completedAt: 2000,
  mediaType: "video",
  mediaUrls: ["https://storage.example.com/users/u1/generations/video.mp4"],
  ...overrides,
});

describe("regression: gallery only shows browseable outputs", () => {
  it("excludes failed generations from gallery entries", () => {
    const entries = buildGalleryGenerationEntries({
      versions: [],
      runtimeGenerations: [
        createGeneration({
          status: "failed",
          mediaUrls: [],
          thumbnailUrl: null,
          error: "Not allowed by CORS",
        }),
      ],
    });

    expect(entries).toHaveLength(0);
  });

  it("excludes completed generations that have neither media nor thumbnail fallback", () => {
    const entries = buildGalleryGenerationEntries({
      versions: [],
      runtimeGenerations: [
        createGeneration({
          mediaUrls: [],
          thumbnailUrl: null,
        }),
      ],
    });

    expect(entries).toHaveLength(0);
  });
});
