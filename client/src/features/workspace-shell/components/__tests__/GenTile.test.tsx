import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenTile } from "../GenTile";
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
    mediaUrls: ["https://example.com/v.mp4"],
    thumbnailUrl: "https://example.com/poster.jpg",
    isFavorite: false,
    generationSettings: null,
    ...p,
  } as Generation;
}

describe("GenTile", () => {
  it("renders a 'queued' (pending) state placeholder", () => {
    render(
      <GenTile
        generation={gen({ status: "pending" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/queued/i)).toBeInTheDocument();
  });

  it("renders a 'rendering' (generating) state with progress shimmer", () => {
    const { container } = render(
      <GenTile
        generation={gen({ status: "generating" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[data-state="rendering"]'),
    ).toBeInTheDocument();
  });

  it("renders a poster image when ready and mediaType is video", () => {
    render(
      <GenTile
        generation={gen({ status: "completed", mediaType: "video" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/poster.jpg");
  });

  it("renders a Continue Scene button only when isFeatured", () => {
    const { rerender, queryByText } = render(
      <GenTile
        generation={gen({ status: "completed" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(queryByText(/continue scene/i)).not.toBeInTheDocument();
    rerender(
      <GenTile
        generation={gen({ status: "completed" })}
        isFeatured={true}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(queryByText(/continue scene/i)).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked on a failed tile", () => {
    const onRetry = vi.fn();
    render(
      <GenTile
        generation={gen({ status: "failed" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByText(/retry/i));
    expect(onRetry).toHaveBeenCalled();
  });
});
