import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CanvasWorkspace } from "../CanvasWorkspace";
import type {
  Generation,
  GenerationsPanelProps,
} from "@features/generations/types";

let runtimeState: {
  heroGeneration: Generation | null;
  generations: Generation[];
} = {
  heroGeneration: null,
  generations: [],
};

vi.mock(
  "@features/generation-controls",
  () => ({
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
  }),
);

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
    ...runtimeState,
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

vi.mock("../components/NewSessionView", () => ({
  NewSessionView: () => <div data-testid="new-session-view" />,
}));

vi.mock("../components/CanvasPromptBar", () => ({
  CanvasPromptBar: () => <div data-testid="canvas-prompt-bar" />,
}));

vi.mock("../components/ModelCornerSelector", () => ({
  ModelCornerSelector: () => <div data-testid="model-corner-selector" />,
}));

vi.mock("../components/CanvasHeroViewer", () => ({
  CanvasHeroViewer: ({ generation }: { generation: Generation | null }) =>
    generation ? (
      <div data-testid="canvas-hero-viewer">{generation.id}</div>
    ) : null,
}));

vi.mock("@/features/prompt-optimizer/components/GalleryPanel", () => ({
  GalleryPanel: () => null,
}));

vi.mock("@/features/prompt-optimizer/components/GenerationPopover", () => ({
  GenerationPopover: () => null,
}));

vi.mock("@/components/modals/CameraMotionModal", () => ({
  CameraMotionModal: () => null,
}));

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: "gen-failed",
  tier: "render",
  status: "failed",
  model: "sora",
  prompt: "A cinematic motorcycle ride through a rainy neon street.",
  promptVersionId: "version-1",
  createdAt: Date.now(),
  completedAt: Date.now(),
  mediaType: "video",
  mediaUrls: [],
  thumbnailUrl: null,
  error: "Timed out waiting for video generation",
  ...overrides,
});

const buildProps = (
  prompt: string,
): React.ComponentProps<typeof CanvasWorkspace> => ({
  generationsPanelProps: {
    prompt,
    versions: [],
    promptVersionId: "version-1",
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
  onReuseGeneration: vi.fn(),
  onToggleGenerationFavorite: vi.fn(),
});

describe("regression: failed hero does not linger while composing a retry", () => {
  it("hides the failed hero once the current prompt no longer matches the failed attempt", async () => {
    runtimeState = {
      heroGeneration: createGeneration(),
      generations: [createGeneration()],
    };

    const originalPrompt =
      "A cinematic motorcycle ride through a rainy neon street.";
    const editedPrompt =
      "A cinematic tracking shot of a motorcyclist crossing a rainy neon downtown avenue.";

    const { rerender } = render(
      <CanvasWorkspace {...buildProps(originalPrompt)} />,
    );

    expect(screen.getByTestId("canvas-hero-viewer")).toHaveTextContent(
      "gen-failed",
    );

    rerender(<CanvasWorkspace {...buildProps(editedPrompt)} />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("canvas-hero-viewer"),
      ).not.toBeInTheDocument();
    });
  });
});
