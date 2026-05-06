import React, { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CanvasSettingsRow } from "../CanvasSettingsRow";
import {
  GenerationControlsProvider,
  useGenerationControlsContext,
  type GenerationControlsHandlers,
} from "@/features/prompt-optimizer/context/GenerationControlsContext";
import { GenerationControlsStoreProvider } from "@features/generation-controls";
import type { GenerationControlsState } from "@features/generation-controls";
import { DEFAULT_GENERATION_CONTROLS_STATE } from "@features/generation-controls";

vi.mock("../StartFramePopover", () => ({
  StartFramePopover: () => <div data-testid="start-frame-popover" />,
}));
vi.mock("../EndFramePopover", () => ({
  EndFramePopover: () => <div data-testid="end-frame-popover" />,
}));
vi.mock("../VideoReferencesPopover", () => ({
  VideoReferencesPopover: () => <div data-testid="video-references-popover" />,
}));
vi.mock(
  "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping",
  () => ({
    useCapabilitiesClamping: () => ({
      schema: {
        provider: "generic",
        model: "google/veo-3",
        version: "1",
        fields: {
          last_frame: { type: "bool", default: true },
          reference_images: { type: "bool", default: true },
          extend_video: { type: "bool", default: true },
        },
      },
      aspectRatioInfo: null,
      durationInfo: null,
      aspectRatioOptions: ["16:9", "9:16"],
      durationOptions: [5, 10],
    }),
  }),
);
vi.mock("@/features/model-intelligence/api", () => ({
  trackModelRecommendationEvent: vi.fn(),
}));

function ControlsBridge({
  controls,
}: {
  controls: GenerationControlsHandlers | null;
}): React.ReactElement | null {
  const { setControls } = useGenerationControlsContext();
  useEffect(() => {
    setControls(controls);
    return () => setControls(null);
  }, [controls, setControls]);
  return null;
}

const buildState = (): GenerationControlsState => ({
  ...DEFAULT_GENERATION_CONTROLS_STATE,
  domain: {
    ...DEFAULT_GENERATION_CONTROLS_STATE.domain,
    selectedModel: "sora-2",
    generationParams: {
      aspect_ratio: "16:9",
      duration_s: 5,
    },
  },
});

const renderRow = (onEnhance: () => void): void => {
  render(
    <GenerationControlsStoreProvider initialState={buildState()}>
      <GenerationControlsProvider>
        <ControlsBridge
          controls={{
            onStoryboard: vi.fn(),
            onDraft: vi.fn(),
            onRender: vi.fn(),
            isGenerating: false,
            activeDraftModel: null,
          }}
        />
        <CanvasSettingsRow
          prompt="A cinematic shot"
          renderModelId="sora-2"
          onOpenMotion={vi.fn()}
          onEnhance={onEnhance}
        />
      </GenerationControlsProvider>
    </GenerationControlsStoreProvider>,
  );
};

/**
 * Regression: ISSUE-42
 *
 * Background: rapid Enhance double-clicks fire `onEnhance` multiple times
 * because the upstream `isOptimizing` guard in PromptCanvas.handleEnhance
 * doesn't flip until React commits a `startTransition`-wrapped state update
 * inside `usePromptOptimizer.optimize`. By the time the user's second click
 * lands (a few hundred milliseconds later), the button is still visibly
 * enabled and the handler fires again. Live repro (2026-05-03): triple-
 * clicking Enhance produced THREE separate POST /api/optimize requests,
 * the first two of which the server's rate limiter rejected with 503 —
 * which surfaced as scary error toasts to the user even though their
 * click eventually succeeded.
 *
 * Mirrors the previous fix for the Preview button's `previewClickCooldownRef`
 * — same shape of bug, same shape of fix, same UI layer.
 *
 * Invariant: For any rapid-fire clicks on the Enhance button issued
 * back-to-back, the onEnhance handler fires AT MOST ONCE.
 */
describe("regression: Enhance button click is debounced against rapid double-fire (ISSUE-42)", () => {
  it("fires onEnhance exactly once when the button is triple-clicked synchronously", () => {
    const onEnhance = vi.fn();
    renderRow(onEnhance);

    const enhanceButton = screen.getByLabelText("Enhance prompt");
    fireEvent.click(enhanceButton);
    fireEvent.click(enhanceButton);
    fireEvent.click(enhanceButton);

    expect(onEnhance).toHaveBeenCalledTimes(1);
  });
});
