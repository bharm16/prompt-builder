import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  // The unified workspace does not yet expose an Enhance button (the legacy
  // CanvasSettingsRow that hosted Enhance is no longer mounted; chromeSlot
  // currently contains only Tune + CostPreview). The enhance-callback wire
  // is a deferred follow-up — restore this test once the unified path wires
  // an Enhance button into chromeSlot.
  it.skip("clicking enhance invokes the provided callback (deferred — no enhance button in unified path)", () => {
    expect(true).toBe(true);
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
