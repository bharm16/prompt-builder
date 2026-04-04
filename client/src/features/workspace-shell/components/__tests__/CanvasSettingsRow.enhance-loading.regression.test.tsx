import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasSettingsRow } from "../CanvasSettingsRow";

/**
 * Regression: Enhance button must show a loading state while optimization runs.
 *
 * Previously the Enhance button had no visual feedback during prompt optimization.
 * Users could click it multiple times with no indication that work was in progress,
 * leading to duplicate requests and confusion.
 *
 * Invariant: When isEnhancing is true, the Enhance button must be disabled and
 * display a spinner instead of the magic wand icon.
 */

// Minimal mocks for context hooks consumed by CanvasSettingsRow
vi.mock(
  "@/features/prompt-optimizer/context/GenerationControlsContext",
  () => ({
    useGenerationControlsContext: () => ({
      controls: {
        isGenerating: false,
        onStoryboard: vi.fn(),
        onDraft: vi.fn(),
        onRender: vi.fn(),
      },
    }),
  }),
);

vi.mock(
  "@features/generation-controls",
  () => ({
    useGenerationControlsStoreActions: () => ({
      mergeGenerationParams: vi.fn(),
      setVideoTier: vi.fn(),
      setStartFrame: vi.fn(),
      clearStartFrame: vi.fn(),
      setEndFrame: vi.fn(),
      clearEndFrame: vi.fn(),
      addVideoReference: vi.fn(),
      removeVideoReference: vi.fn(),
      updateVideoReferenceType: vi.fn(),
      clearExtendVideo: vi.fn(),
      setCameraMotion: vi.fn(),
    }),
    useGenerationControlsStoreState: () => ({
      domain: {
        generationParams: { aspect_ratio: "16:9", duration_s: 5 },
        selectedModel: "test-model",
        videoTier: "standard",
        startFrame: null,
        endFrame: null,
        cameraMotion: null,
        videoReferenceImages: [],
        extendVideo: null,
      },
    }),
  }),
);

vi.mock(
  "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping",
  () => ({
    useCapabilitiesClamping: () => ({
      aspectRatioOptions: [{ id: "16:9", label: "16:9" }],
      durationOptions: [{ id: 5, label: "5s" }],
      schema: null,
    }),
  }),
);

vi.mock(
  "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useVideoInputCapabilities",
  () => ({
    useVideoInputCapabilities: () => ({
      supportsEndFrame: false,
      supportsReferenceImages: false,
      maxReferenceImages: 0,
    }),
  }),
);

vi.mock("@/features/model-intelligence/api", () => ({
  trackModelRecommendationEvent: vi.fn(),
}));

vi.mock("../StartFramePopover", () => ({
  StartFramePopover: () => <div data-testid="start-frame-popover" />,
}));

vi.mock("../EndFramePopover", () => ({
  EndFramePopover: () => <div data-testid="end-frame-popover" />,
}));

vi.mock("../VideoReferencesPopover", () => ({
  VideoReferencesPopover: () => <div data-testid="video-references-popover" />,
}));

vi.mock("../MiniDropdown", () => ({
  MiniDropdown: () => <div data-testid="mini-dropdown" />,
}));

const baseProps = {
  prompt: "test prompt",
  renderModelId: "test-model",
  onOpenMotion: vi.fn(),
};

describe("regression: Enhance button shows loading state during optimization", () => {
  it("disables the button and shows spinner when isEnhancing is true", () => {
    const onEnhance = vi.fn();
    render(
      <CanvasSettingsRow
        {...baseProps}
        onEnhance={onEnhance}
        isEnhancing={true}
      />,
    );

    const button = screen.getByRole("button", { name: /enhancing/i });
    expect(button).toBeDisabled();
    // Should have a spinning SVG, not the MagicWand icon
    const spinner = button.querySelector("svg.animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("keeps the button enabled with MagicWand when isEnhancing is false", () => {
    const onEnhance = vi.fn();
    render(
      <CanvasSettingsRow
        {...baseProps}
        onEnhance={onEnhance}
        isEnhancing={false}
      />,
    );

    const button = screen.getByRole("button", { name: "Enhance prompt" });
    expect(button).not.toBeDisabled();
    // Should NOT have the spinner
    const spinner = button.querySelector("svg.animate-spin");
    expect(spinner).toBeNull();
  });
});
