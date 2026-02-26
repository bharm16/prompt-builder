import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VIDEO_RENDER_MODELS } from "@components/ToolSidebar/config/modelConfig";
import { ModelRecommendationDropdown } from "../ModelRecommendationDropdown";

vi.mock("@promptstudio/system/components/ui", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
    <svg {...props} />
  );
  return {
    CaretDown: Icon,
    Star: Icon,
    WarningCircle: Icon,
  };
});

describe("ModelRecommendationDropdown", () => {
  it("uses provided render model options for the non-recommended list", async () => {
    const user = userEvent.setup();

    render(
      <ModelRecommendationDropdown
        renderModelOptions={[
          { id: "sora-2", label: "Sora" },
          { id: "google/veo-3", label: "Veo" },
        ]}
        renderModelId="sora-2"
        onModelChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Video model" }));

    expect(screen.getByRole("option", { name: /Sora/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Veo/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Kling/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Luma/i }),
    ).not.toBeInTheDocument();
  });

  it("renders recommended section when recommendation model ids require alias normalization", async () => {
    const user = userEvent.setup();

    render(
      <ModelRecommendationDropdown
        renderModelOptions={VIDEO_RENDER_MODELS.map((model) => ({
          id: model.id,
          label: model.label,
        }))}
        renderModelId="sora-2"
        onModelChange={vi.fn()}
        recommendedModelId="google/veo-3"
        modelRecommendation={{
          promptId: "prompt_alias",
          prompt: "A dramatic slow-motion action scene",
          recommendations: [
            {
              modelId: "veo-4",
              overallScore: 92,
              factorScores: [],
              strengths: ["cinematic lighting", "atmospherics"],
              weaknesses: [],
              warnings: [],
            },
          ],
          recommended: {
            modelId: "veo-4",
            reasoning: "Strong cinematic composition and lighting control",
          },
          suggestComparison: false,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Video model" }));

    expect(screen.getByText("Recommended for this prompt")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Veo/ })).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
  });
});
