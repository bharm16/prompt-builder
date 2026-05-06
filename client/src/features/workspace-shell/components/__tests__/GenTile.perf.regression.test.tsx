import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShotRow } from "../ShotRow";
import type { Shot } from "../../utils/groupShots";
import type { Generation } from "@features/generations/types";

vi.mock("../../events", () => ({ dispatchContinueScene: vi.fn() }));

function gen(id: string, status: Generation["status"]): Generation {
  return {
    id,
    tier: "render",
    status,
    model: "sora-2",
    prompt: "x",
    promptVersionId: id.slice(0, 1),
    createdAt: 1,
    completedAt: 1,
    mediaType: "video",
    mediaUrls: ["https://example.com/v.mp4"],
    thumbnailUrl: "https://example.com/p.jpg",
    isFavorite: false,
    generationSettings: null,
  } as Generation;
}

/**
 * GenTile poster-only baseline lock.
 *
 * The current implementation always renders an <img> poster, never a <video>
 * — this is the simplest path that satisfies spec §10's "only featured tile
 * preloads video" mitigation (zero videos is ≤ 1, so we trivially pass the
 * spec's perf budget). When the featured-tile video swap lands later, this
 * test should relax to `videos.length <= 1` rather than be deleted — the
 * cap is the actual contract; "zero videos" is just the current floor.
 */
describe("GenTile — poster-only baseline (no <video> elements rendered)", () => {
  it("renders 8 completed tiles with poster <img> only and no <video>", () => {
    const tiles = Array.from({ length: 8 }, (_, i) =>
      gen(`g${i}`, "completed"),
    );
    const shot: Shot = {
      id: "v",
      promptSummary: "p",
      modelId: "m",
      createdAt: 1,
      tiles,
      status: "ready",
    };
    const { container } = render(
      <ShotRow
        shot={shot}
        now={1_000}
        layout="featured"
        featuredTileId="g0"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    const videos = container.querySelectorAll("video");
    // Hard cap: at most 1 active <video> per shot. Today the implementation
    // chooses 0 (poster-only); this assertion will keep holding when the
    // featured-tile video swap is wired and a single <video> appears for the
    // featured slot.
    expect(videos.length).toBeLessThanOrEqual(1);
    expect(videos.length).toBe(0); // current floor — remove when video swap lands
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(8);
  });
});
