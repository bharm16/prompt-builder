import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  CanvasHeroViewer: () => <div data-testid="canvas-hero-viewer" />,
}));

vi.mock("@/features/prompt-optimizer/components/GalleryPanel", () => ({
  GalleryPanel: ({
    generations,
    onSelectGeneration,
  }: {
    generations: Array<{ id: string }>;
    onSelectGeneration: (generationId: string) => void;
  }) => (
    <div data-testid="gallery-panel">
      {generations.map((generation) => (
        <button
          key={generation.id}
          type="button"
          data-testid={`gallery-select-${generation.id}`}
          onClick={() => onSelectGeneration(generation.id)}
        >
          {generation.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/features/prompt-optimizer/components/GenerationPopover", () => ({
  GenerationPopover: ({ activeId }: { activeId: string }) => (
    <div data-testid="generation-popover">{activeId}</div>
  ),
}));

vi.mock("@/components/modals/CameraMotionModal", () => ({
  CameraMotionModal: () => null,
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
  mediaUrls: ["https://storage.example.com/users/u1/generations/video.mp4"],
  thumbnailUrl:
    "https://storage.example.com/users/u1/previews/images/thumb.webp",
  ...overrides,
});

const buildProps = (): React.ComponentProps<typeof CanvasWorkspace> => ({
  generationsPanelProps: {
    prompt: "baby driving a car",
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

describe("regression: canvas closes stale generation popovers when gallery items disappear", () => {
  beforeEach(() => {
    runtimeState = {
      heroGeneration: null,
      generations: [],
    };
  });

  it("clears the active popover when the selected gallery item is no longer browseable", async () => {
    const generation = createGeneration();
    runtimeState = {
      heroGeneration: generation,
      generations: [generation],
    };

    const user = userEvent.setup();
    const props = buildProps();
    const { rerender } = render(<CanvasWorkspace {...props} />);

    await user.click(screen.getByTestId("gallery-select-gen-1"));
    expect(screen.getByTestId("generation-popover")).toHaveTextContent("gen-1");

    runtimeState = {
      heroGeneration: {
        ...generation,
        status: "failed",
        mediaUrls: [],
        thumbnailUrl: null,
        error: "Not allowed by CORS",
      },
      generations: [
        {
          ...generation,
          status: "failed",
          mediaUrls: [],
          thumbnailUrl: null,
          error: "Not allowed by CORS",
        },
      ],
    };

    rerender(<CanvasWorkspace {...props} />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("generation-popover"),
      ).not.toBeInTheDocument();
    });
  });
});
