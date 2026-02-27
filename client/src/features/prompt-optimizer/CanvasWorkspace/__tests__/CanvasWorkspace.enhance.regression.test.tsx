import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Generation, GenerationsPanelProps } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { CanvasWorkspace } from '../CanvasWorkspace';

vi.mock('@/features/prompt-optimizer/context/GenerationControlsStore', () => ({
  useGenerationControlsStoreActions: () => ({
    setSelectedModel: vi.fn(),
    setVideoTier: vi.fn(),
    setCameraMotion: vi.fn(),
  }),
  useGenerationControlsStoreState: () => ({
    domain: {
      generationParams: { duration_s: 5 },
      startFrame: null,
      selectedModel: 'sora-2',
      videoTier: 'render',
      cameraMotion: null,
    },
  }),
}));

vi.mock('@/features/prompt-optimizer/context/PromptStateContext', () => ({
  useOptionalPromptHighlights: () => null,
}));

vi.mock('@/features/prompt-optimizer/context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => ({
    hasActiveContinuityShot: false,
    currentShot: null,
    updateShot: vi.fn(),
  }),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel', () => ({
  useGenerationsRuntime: () => ({
    heroGeneration: null,
    generations: [],
  }),
}));

vi.mock('@/components/ToolSidebar/context', () => ({
  useSidebarGenerationDomain: () => null,
}));

vi.mock(
  '@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation',
  () => ({
    useModelSelectionRecommendation: () => ({
      recommendationMode: 't2v',
      modelRecommendation: null,
      recommendedModelId: undefined,
      efficientModelId: undefined,
      renderModelOptions: [{ id: 'sora-2', label: 'Sora' }],
      renderModelId: 'sora-2',
      recommendationAgeMs: null,
    }),
  })
);

vi.mock('../components/CanvasTopBar', () => ({
  CanvasTopBar: () => <div data-testid="canvas-top-bar" />,
}));

vi.mock('../components/NewSessionView', () => ({
  NewSessionView: ({ onEnhance }: { onEnhance?: () => void }) => (
    <button type="button" data-testid="new-session-enhance" onClick={() => onEnhance?.()}>
      Enhance
    </button>
  ),
}));

vi.mock('../components/CanvasPromptBar', () => ({
  CanvasPromptBar: () => <div data-testid="canvas-prompt-bar" />,
}));

vi.mock('../components/ModelCornerSelector', () => ({
  ModelCornerSelector: () => null,
}));

vi.mock('../components/CanvasHeroViewer', () => ({
  CanvasHeroViewer: () => null,
}));

vi.mock('@/features/prompt-optimizer/components/GalleryPanel', () => ({
  GalleryPanel: () => null,
}));

vi.mock('@/features/prompt-optimizer/components/GenerationPopover', () => ({
  GenerationPopover: () => null,
}));

vi.mock('@/components/modals/CameraMotionModal', () => ({
  CameraMotionModal: () => null,
}));

const buildProps = (): React.ComponentProps<typeof CanvasWorkspace> => ({
  generationsPanelProps: {
    prompt: 'baby driving a car',
    versions: [],
    promptVersionId: 'version-1',
  } as unknown as GenerationsPanelProps,
  copied: false,
  canUndo: false,
  canRedo: false,
  onCopy: vi.fn(),
  onShare: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  editorRef: React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
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
  suggestionsListRef: React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
  inlineSuggestions: [],
  activeSuggestionIndex: 0,
  onActiveSuggestionChange: vi.fn(),
  interactionSourceRef: { current: 'auto' },
  onSuggestionClick: vi.fn(),
  onCloseInlinePopover: vi.fn(),
  selectionLabel: '',
  onApplyActiveSuggestion: vi.fn(),
  isInlineLoading: false,
  isInlineError: false,
  inlineErrorMessage: '',
  isInlineEmpty: true,
  customRequest: '',
  onCustomRequestChange: vi.fn(),
  customRequestError: '',
  onCustomRequestErrorChange: vi.fn(),
  onCustomRequestSubmit: vi.fn(),
  isCustomRequestDisabled: true,
  isCustomLoading: false,
  showI2VLockIndicator: false,
  resolvedI2VReason: null,
  i2vMotionAlternatives: [],
  onLockedAlternativeClick: vi.fn(),
  onReuseGeneration: vi.fn((_generation: Generation) => undefined),
  onToggleGenerationFavorite: vi.fn(),
});

describe('regression: canvas enhance callback wiring', () => {
  it('clicking enhance in empty-session view invokes provided callback', async () => {
    const onEnhance = vi.fn();
    const user = userEvent.setup();
    render(<CanvasWorkspace {...buildProps()} onEnhance={onEnhance} />);

    await user.click(screen.getByTestId('new-session-enhance'));

    expect(onEnhance).toHaveBeenCalledTimes(1);
  });
});
