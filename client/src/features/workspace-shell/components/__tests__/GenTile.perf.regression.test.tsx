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

describe("GenTile perf — at most one <video> element actively renders per shot", () => {
  it("renders 8 completed tiles with poster <img> only (no <video>)", () => {
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
        layout="featured"
        featuredTileId="g0"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    const videos = container.querySelectorAll("video");
    expect(videos.length).toBe(0);
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(8);
  });
});
