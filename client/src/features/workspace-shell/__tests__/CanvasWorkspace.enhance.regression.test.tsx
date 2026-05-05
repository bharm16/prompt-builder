import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type {
  Generation,
  GenerationsPanelProps,
} from "@features/generations/types";
import { CanvasWorkspace } from "../CanvasWorkspace";

vi.mock("@features/generation-controls", () => ({
  useGenerationControlsStoreActions: () => ({
    setSelectedModel: vi.fn(),
    setVideoTier: vi.fn(),
    setCameraMotion: vi.fn(),
  }),
  useGenerationControlsStoreState: () => ({
    domain: {
      generationParams: { duration_s: 5 },
      startFrame: null,
      selectedModel: "sora-2",
      videoTier: "render",
      cameraMotion: null,
    },
  }),
}));

vi.mock("@/features/prompt-optimizer/context/PromptStateContext", () => ({
  useOptionalPromptHighlights: () => null,
}));

// CanvasSettingsRow consumes GenerationControlsContext for its Preview /
// Generate / Enhance gating; the regression doesn't exercise those branches,
// but the hook throws when no provider is mounted, so stub it inline.
vi.mock(
  "@/features/prompt-optimizer/context/GenerationControlsContext",
  () => ({
    useGenerationControlsContext: () => ({
      controls: null,
      setControls: vi.fn(),
      onStoryboard: null,
      onInsufficientCredits: null,
      setOnInsufficientCredits: vi.fn(),
      faceSwapPreview: null,
      setFaceSwapPreview: vi.fn(),
    }),
  }),
);

vi.mock("@/features/prompt-optimizer/context/WorkspaceSessionContext", () => ({
  useWorkspaceSession: () => ({
    hasActiveContinuityShot: false,
    currentShot: null,
    updateShot: vi.fn(),
  }),
}));

vi.mock("@features/generations", () => ({
  useGenerationsRuntime: () => ({
    heroGeneration: null,
    generations: [],
    handleCancel: vi.fn(),
    handleRetry: vi.fn(),
  }),
}));

vi.mock("@/components/ToolSidebar/context", () => ({
  useSidebarGenerationDomain: () => null,
}));

vi.mock(
  "@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation",
  () => ({
    useModelSelectionRecommendation: () => ({
      recommendationMode: "t2v",
      modelRecommendation: null,
      recommendedModelId: undefined,
      efficientModelId: undefined,
      renderModelOptions: [{ id: "sora-2", label: "Sora" }],
      renderModelId: "sora-2",
      recommendationAgeMs: null,
    }),
  }),
);

vi.mock("../components/WorkspaceTopBar", () => ({
  WorkspaceTopBar: () => <header role="banner">topbar</header>,
}));

vi.mock("../components/ModelCornerSelector", () => ({
  ModelCornerSelector: () => <div data-testid="model-corner-selector" />,
}));

vi.mock("@/features/prompt-optimizer/components/GenerationPopover", () => ({
  GenerationPopover: () => null,
}));

vi.mock("@/components/modals/CameraMotionModal", () => ({
  CameraMotionModal: () => null,
}));

const buildProps = (): React.ComponentProps<typeof CanvasWorkspace> => ({
  generationsPanelProps: {
    prompt: "baby driving a car",
    versions: [],
    promptVersionId: "",
  } as unknown as GenerationsPanelProps,
  copied: false,
  canUndo: false,
  canRedo: false,
  onCopy: vi.fn(),
  onShare: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  editorRef:
    React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
  onTextSelection: vi.fn(),
  onHighlightClick: vi.fn(),
  onHighlightMouseDown: vi.fn(),
  onHighlightMouseEnter: vi.fn(),
  onHighlightMouseLeave: vi.fn(),
  onCopyEvent: vi.fn(),
  onInput: vi.fn(),
  onEditorKeyDown: vi.fn(),
  onEditorBlur: vi.fn(),
  autocompleteOpen: false,
  autocompleteSuggestions: [],
  autocompleteSelectedIndex: 0,
  autocompletePosition: { top: 0, left: 0 },
  autocompleteLoading: false,
  onAutocompleteSelect: vi.fn(),
  onAutocompleteClose: vi.fn(),
  onAutocompleteIndexChange: vi.fn(),
  selectedSpanId: null,
  suggestionCount: 0,
  suggestionsListRef:
    React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
  inlineSuggestions: [],
  activeSuggestionIndex: 0,
  onActiveSuggestionChange: vi.fn(),
  interactionSourceRef: { current: "auto" },
  onSuggestionClick: vi.fn(),
  onCloseInlinePopover: vi.fn(),
  selectionLabel: "",
  onApplyActiveSuggestion: vi.fn(),
  isInlineLoading: false,
  isInlineError: false,
  inlineErrorMessage: "",
  isInlineEmpty: true,
  customRequest: "",
  onCustomRequestChange: vi.fn(),
  customRequestError: "",
  onCustomRequestErrorChange: vi.fn(),
  onCustomRequestSubmit: vi.fn(),
  isCustomRequestDisabled: true,
  isCustomLoading: false,
  enableMLHighlighting: false,
  showI2VLockIndicator: false,
  resolvedI2VReason: null,
  i2vMotionAlternatives: [],
  onLockedAlternativeClick: vi.fn(),
  onReuseGeneration: vi.fn((_generation: Generation) => undefined),
  onToggleGenerationFavorite: vi.fn(),
});

describe("regression: canvas enhance / empty-session shell wiring", () => {
  // CanvasSettingsRow (mounted inside CanvasPromptBar's chromeSlot) hosts the
  // Enhance button. The button is gated on a non-empty prompt and a provided
  // onEnhance callback; clicking it must invoke the orchestrator's onEnhance
  // exactly once. Regression for the gap left by the unified-workspace flag
  // removal — the Enhance button was previously unmounted.
  it("clicking enhance invokes the provided callback", () => {
    const onEnhance = vi.fn();
    const props = buildProps();
    render(<CanvasWorkspace {...props} onEnhance={onEnhance} />);

    const enhanceButton = screen.getByRole("button", { name: /enhance/i });
    fireEvent.click(enhanceButton);

    expect(onEnhance).toHaveBeenCalledTimes(1);
  });

  it("keeps a single prompt textbox and a model corner selector in the empty-session shell", () => {
    // Empty session = no prompt, no shots. Under the unified path the
    // floating composer always mounts; the prompt textbox lives there.
    // The model corner selector mounts at the top-right of the canvas.
    const props = buildProps();
    render(
      <CanvasWorkspace
        {...props}
        generationsPanelProps={{
          ...(props.generationsPanelProps as GenerationsPanelProps),
          prompt: "",
        }}
      />,
    );

    expect(
      screen.getAllByRole("textbox", { name: "Optimized prompt" }),
    ).toHaveLength(1);
    expect(screen.getAllByTestId("model-corner-selector")).toHaveLength(1);
  });

  it("does not lock the user into empty state when prompt content exists, even without a prompt version id", () => {
    // The legacy implementation could erroneously remain in empty-state
    // chrome when promptVersionId was missing despite a hydrated prompt.
    // The unified workspace derives the moment from the prompt text +
    // shot grid alone; an empty version id does not force empty-state.
    // We assert this by confirming the prompt textbox is rendered and the
    // empty-hero headline ("What are you making?") is gone once the prompt
    // has content.
    const props = buildProps();
    render(
      <CanvasWorkspace
        {...props}
        enableMLHighlighting
        generationsPanelProps={{
          ...(props.generationsPanelProps as GenerationsPanelProps),
          prompt: "The camera tracks a subject through warm golden light.",
          promptVersionId: "",
        }}
      />,
    );

    expect(screen.queryByText("What are you making?")).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Optimized prompt" }),
    ).toBeInTheDocument();
  });
});
