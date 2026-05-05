import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFeaturedTile } from "../useFeaturedTile";
import type { Shot } from "../../utils/groupShots";
import type { Generation } from "@features/generations/types";

function gen(p: Partial<Generation>): Generation {
  return {
    id: "g",
    tier: "render",
    status: "completed",
    model: "sora-2",
    prompt: "x",
    promptVersionId: "v",
    createdAt: 1,
    completedAt: 1,
    mediaType: "video",
    mediaUrls: ["u"],
    isFavorite: false,
    generationSettings: null,
    ...p,
  } as Generation;
}

function shot(tiles: Generation[]): Shot {
  return {
    id: "v",
    promptSummary: "x",
    modelId: "sora-2",
    createdAt: 1,
    tiles,
    status: "ready",
  };
}

describe("useFeaturedTile", () => {
  it("returns null when no shots", () => {
    const { result } = renderHook(() =>
      useFeaturedTile({ shots: [], heroGeneration: null, currentPrompt: "" }),
    );
    expect(result.current).toBeNull();
  });

  it("returns the tile matching heroGeneration.id when present in active shot", () => {
    const tiles = [
      gen({ id: "a", status: "completed" }),
      gen({ id: "b", status: "completed" }),
    ];
    const { result } = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: tiles[1] ?? null,
        currentPrompt: "",
      }),
    );
    expect(result.current?.id).toBe("b");
  });

  it("falls back to the first completed tile when hero is missing", () => {
    const tiles = [
      gen({ id: "a", status: "pending" }),
      gen({ id: "b", status: "completed" }),
    ];
    const { result } = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: null,
        currentPrompt: "",
      }),
    );
    expect(result.current?.id).toBe("b");
  });

  it("preserves failed hero only when current prompt matches its prompt", () => {
    const failedHero = gen({
      id: "f",
      status: "failed",
      prompt: "neon market",
    });
    const tiles = [failedHero, gen({ id: "ok", status: "completed" })];
    // Same prompt → keep showing the failed hero (so retry message is visible).
    const same = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: failedHero,
        currentPrompt: "neon market",
      }),
    );
    expect(same.result.current?.id).toBe("f");
    // Different prompt → fall through to the next ready tile.
    const diff = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: failedHero,
        currentPrompt: "rainy alley",
      }),
    );
    expect(diff.result.current?.id).toBe("ok");
  });
});
