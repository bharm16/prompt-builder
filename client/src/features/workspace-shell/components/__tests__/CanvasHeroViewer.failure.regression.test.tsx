import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CanvasHeroViewer } from "../CanvasHeroViewer";
import type { Generation } from "@features/generations/types";

vi.mock("@/hooks/useResolvedMediaUrl", () => ({
  useResolvedMediaUrl: () => ({ url: null }),
}));

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: "gen-1",
  tier: "render",
  status: "completed",
  model: "sora",
  prompt: "Prompt",
  promptVersionId: "version-1",
  createdAt: Date.now(),
  completedAt: Date.now(),
  mediaType: "video",
  mediaUrls: [],
  ...overrides,
});

describe("regression: canvas hero viewer keeps failure states honest", () => {
  it("shows the surfaced error for failed generations instead of success metadata", () => {
    render(
      <CanvasHeroViewer
        generation={createGeneration({
          status: "failed",
          error: "Not allowed by CORS",
        })}
      />,
    );

    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByText("Not allowed by CORS")).toBeInTheDocument();
    expect(screen.queryByText(/final/i)).not.toBeInTheDocument();
  });

  it("shows an unavailable state for completed generations without any usable media", () => {
    render(<CanvasHeroViewer generation={createGeneration()} />);

    expect(screen.getByText("Generation unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("No media is available for this generation."),
    ).toBeInTheDocument();
  });

  it("keeps cancel available while a render is still generating", () => {
    const onCancel = vi.fn();

    render(
      <CanvasHeroViewer
        generation={createGeneration({
          status: "generating",
          completedAt: null,
          serverProgress: 42,
          serverJobStatus: "processing",
        })}
        onCancel={onCancel}
      />,
    );

    screen.getByRole("button", { name: "Cancel render" }).click();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
