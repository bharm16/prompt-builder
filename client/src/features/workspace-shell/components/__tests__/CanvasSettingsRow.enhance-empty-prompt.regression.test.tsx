import React, { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

const baseControls: GenerationControlsHandlers = {
  onStoryboard: vi.fn(),
  onDraft: vi.fn(),
  onRender: vi.fn(),
  isGenerating: false,
  activeDraftModel: null,
};

const renderRow = (props: {
  prompt: string;
  onEnhance?: () => void;
  isEnhancing?: boolean;
}): void => {
  render(
    <GenerationControlsStoreProvider initialState={buildState()}>
      <GenerationControlsProvider>
        <ControlsBridge controls={baseControls} />
        <CanvasSettingsRow
          prompt={props.prompt}
          renderModelId="sora-2"
          onOpenMotion={vi.fn()}
          {...(props.isEnhancing !== undefined
            ? { isEnhancing: props.isEnhancing }
            : {})}
          {...(props.onEnhance ? { onEnhance: props.onEnhance } : {})}
        />
      </GenerationControlsProvider>
    </GenerationControlsStoreProvider>,
  );
};

// Regression: ISSUE-39
//
// Invariant: when the prompt is empty (or whitespace-only), the AI Enhance
// button must be rendered as `disabled` so the user gets the same kind of
// "you can't do this yet" affordance as every other action that depends on
// a non-empty prompt.
//
// Live observation (2026-05-02): clicking Enhance with an empty prompt
// produced ZERO user-visible feedback — no toast, no error, no
// disabled state. The handler in PromptCanvas.handleEnhance silently
// returns when `editorDisplayText.trim()` is empty, so the click is a
// no-op. Combined with the absence of a disabled affordance, the
// button looks broken to the user.
//
// The `onReoptimize` chain is still required for the click to do anything
// when the prompt is non-empty, so we keep `!onEnhance` in the disabled
// condition — but we ALSO disable when the prompt is empty.

describe("regression: Enhance button is disabled when prompt is empty (ISSUE-39)", () => {
  it("disables the Enhance button when prompt is an empty string", () => {
    renderRow({ prompt: "", onEnhance: vi.fn() });
    const button = screen.getByLabelText("Enhance prompt");
    expect(button).toBeDisabled();
  });

  it("disables the Enhance button when prompt is whitespace-only", () => {
    renderRow({ prompt: "   \n\t  ", onEnhance: vi.fn() });
    const button = screen.getByLabelText("Enhance prompt");
    expect(button).toBeDisabled();
  });

  it("enables the Enhance button when prompt has content and onEnhance is wired", () => {
    renderRow({ prompt: "a samurai", onEnhance: vi.fn() });
    const button = screen.getByLabelText("Enhance prompt");
    expect(button).not.toBeDisabled();
  });

  it("stays disabled when onEnhance is missing even with a non-empty prompt", () => {
    // Existing contract: no callback → no point in firing. Lock it.
    renderRow({ prompt: "a samurai" });
    const button = screen.getByLabelText("Enhance prompt");
    expect(button).toBeDisabled();
  });

  it("stays disabled while an enhancement is already in flight", () => {
    // The disabled prop is a 3-way OR (`isEnhancing || !onEnhance || !hasPrompt`).
    // A regression that flips the sign of the `isEnhancing` term — for example,
    // `!isEnhancing` from a careless refactor — would let the user fire a
    // second concurrent enhancement, which the underlying handler is not built
    // to handle. Lock the in-flight branch independently of the empty-prompt
    // and missing-handler branches above.
    renderRow({ prompt: "a samurai", onEnhance: vi.fn(), isEnhancing: true });
    const button = screen.getByLabelText("Enhancing prompt…");
    expect(button).toBeDisabled();
  });
});
