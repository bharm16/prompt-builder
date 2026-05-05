import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShotRow } from "../ShotRow";
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
    thumbnailUrl: "https://example.com/p.jpg",
    isFavorite: false,
    generationSettings: null,
    ...p,
  } as Generation;
}

const shot: Shot = {
  id: "v1",
  promptSummary: "neon market in the rain",
  modelId: "sora-2",
  createdAt: Date.now() - 60_000,
  tiles: [
    gen({ id: "a" }),
    gen({ id: "b" }),
    gen({ id: "c" }),
    gen({ id: "d" }),
  ],
  status: "ready",
};

describe("ShotRow", () => {
  it("renders the prompt summary in the header", () => {
    render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="a"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    expect(screen.getByText("neon market in the rain")).toBeInTheDocument();
  });

  it("renders all tiles", () => {
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="a"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("[data-generation-id]")).toHaveLength(4);
  });

  it("marks the featured tile via class (ring-)", () => {
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="b"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    const tiles = container.querySelectorAll("[data-generation-id]");
    expect(tiles[1]?.className).toMatch(/ring-/);
  });

  it("uses compact layout class when layout='compact'", () => {
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="compact"
        featuredTileId={null}
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[data-layout="compact"]'),
    ).toBeInTheDocument();
  });
});
