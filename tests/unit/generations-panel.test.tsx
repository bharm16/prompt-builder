import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { GenerationsPanel } from '@features/prompt-optimizer/GenerationsPanel/GenerationsPanel';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import { VIDEO_DRAFT_MODEL } from '@components/ToolSidebar/config/modelConfig';

const mockUseGenerationsState = vi.fn();
const mockUseGenerationActions = vi.fn();
const mockUseGenerationsTimeline = vi.fn();
const mockUseAssetReferenceImages = vi.fn();
const mockUseKeyframeWorkflow = vi.fn();
const mockUseGenerationControlsContext = vi.fn();
const mockUseWorkspaceSession = vi.fn();
const mockUseGenerationControlsStoreState = vi.fn();
const mockUseGenerationControlsStoreActions = vi.fn();

const generationCardSpy = vi.fn();
const versionDividerSpy = vi.fn();
const keyframeStepSpy = vi.fn();

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsState', () => ({
  useGenerationsState: (args: unknown) => mockUseGenerationsState(args),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions', () => ({
  useGenerationActions: (dispatch: unknown, options: unknown) =>
    mockUseGenerationActions(dispatch, options),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsTimeline', () => ({
  useGenerationsTimeline: (args: unknown) => mockUseGenerationsTimeline(args),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useAssetReferenceImages', () => ({
  useAssetReferenceImages: (prompt: string) => mockUseAssetReferenceImages(prompt),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationMediaRefresh', () => ({
  useGenerationMediaRefresh: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/hooks/useKeyframeWorkflow', () => ({
  useKeyframeWorkflow: (args: unknown) => mockUseKeyframeWorkflow(args),
}));

vi.mock('@features/prompt-optimizer/context/GenerationControlsContext', () => ({
  useGenerationControlsContext: () => mockUseGenerationControlsContext(),
}));

vi.mock('@features/prompt-optimizer/context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => mockUseWorkspaceSession(),
}));

vi.mock('@features/prompt-optimizer/context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => mockUseGenerationControlsStoreState(),
  useGenerationControlsStoreActions: () => mockUseGenerationControlsStoreActions(),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/components/GenerationCard', () => ({
  GenerationCard: (props: { generation: Generation }) => {
    generationCardSpy(props);
    return <div data-testid="generation-card">{props.generation.id}</div>;
  },
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/components/VersionDivider', () => ({
  VersionDivider: (props: { versionLabel: string }) => {
    versionDividerSpy(props);
    return <div data-testid="version-divider">{props.versionLabel}</div>;
  },
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/components/KeyframeStep', () => ({
  KeyframeStep: (props: { character: { trigger: string } }) => {
    keyframeStepSpy(props);
    return <div data-testid="keyframe-step">{props.character.trigger}</div>;
  },
}));

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-1',
  tier: 'draft',
  status: 'completed',
  model: 'wan-2.2',
  prompt: 'Prompt',
  promptVersionId: 'version-1',
  createdAt: 1,
  completedAt: 2,
  mediaType: 'video',
  mediaUrls: ['https://cdn/video.mp4'],
  thumbnailUrl: null,
  error: null,
  ...overrides,
});

describe('GenerationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGenerationsState.mockReturnValue({
      generations: [],
      activeGenerationId: null,
      isGenerating: false,
      dispatch: vi.fn(),
      getLatestByTier: vi.fn(() => null),
      removeGeneration: vi.fn(),
    });
    mockUseGenerationActions.mockReturnValue({
      generateDraft: vi.fn(),
      generateRender: vi.fn(),
      generateStoryboard: vi.fn(),
      retryGeneration: vi.fn(),
      cancelGeneration: vi.fn(),
    });
    mockUseGenerationsTimeline.mockReturnValue([]);
    mockUseAssetReferenceImages.mockReturnValue({ referenceImages: [], resolvedPrompt: null });
    mockUseKeyframeWorkflow.mockReturnValue({
      keyframeStep: { isActive: false, character: null, pendingModel: null },
      selectedKeyframe: null,
      handleRender: vi.fn(),
      handleApproveKeyframe: vi.fn(),
      handleSkipKeyframe: vi.fn(),
      handleSelectFrame: vi.fn(),
      handleClearSelectedFrame: vi.fn(),
    });
    mockUseGenerationControlsContext.mockReturnValue({
      setControls: vi.fn(),
      keyframes: [],
      cameraMotion: null,
      subjectMotion: '',
    });
    mockUseWorkspaceSession.mockReturnValue({
      isSequenceMode: false,
      isStartingSequence: false,
      startSequence: vi.fn(),
      currentShot: null,
      generateShot: vi.fn(),
      updateShot: vi.fn(),
    });
    mockUseGenerationControlsStoreState.mockReturnValue({
      domain: {
        keyframes: [],
        cameraMotion: null,
        subjectMotion: '',
      },
    });
    mockUseGenerationControlsStoreActions.mockReturnValue({
      setKeyframes: vi.fn(),
    });
  });

  describe('error handling', () => {
    it('disables the run draft action when prompt is empty', () => {
      render(
        <GenerationsPanel
          prompt="   "
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={vi.fn()}
        />
      );

      const runDraftButton = screen.getByRole('button', { name: /run draft/i });
      expect(runDraftButton).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('triggers draft generation from empty state', () => {
      const generateDraft = vi.fn();
      mockUseGenerationActions.mockReturnValue({
        generateDraft,
        generateRender: vi.fn(),
        generateStoryboard: vi.fn(),
        retryGeneration: vi.fn(),
        cancelGeneration: vi.fn(),
      });

      const onCreateVersionIfNeeded = vi.fn().mockReturnValue('version-2');

      render(
        <GenerationsPanel
          prompt="New prompt"
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={onCreateVersionIfNeeded}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /run draft/i }));
      expect(generateDraft).toHaveBeenCalledWith(VIDEO_DRAFT_MODEL.id, 'New prompt', {
        promptVersionId: 'version-2',
      });
    });
  });

  describe('core behavior', () => {
    it('renders timeline items and wires controls context', () => {
      mockUseGenerationsTimeline.mockReturnValue([
        { type: 'divider', versionId: 'version-1', versionLabel: 'v1', promptChanged: false, timestamp: 1 },
        { type: 'generation', generation: createGeneration({ id: 'gen-1' }), timestamp: 1 },
      ]);

      const setControls = vi.fn();
      mockUseGenerationControlsContext.mockReturnValue({
        setControls,
        keyframes: [],
        cameraMotion: null,
        subjectMotion: '',
      });

      const { unmount } = render(
        <GenerationsPanel
          prompt="Prompt"
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[
            {
              versionId: 'version-1',
              label: 'v1',
              signature: 'sig-1',
              prompt: 'Prompt',
              timestamp: new Date(1).toISOString(),
              generations: [],
            },
          ]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={vi.fn()}
        />
      );

      expect(screen.getByTestId('version-divider')).toBeInTheDocument();
      expect(screen.getByTestId('generation-card')).toBeInTheDocument();
      expect(setControls).toHaveBeenCalledWith(
        expect.objectContaining({ onDraft: expect.any(Function), onRender: expect.any(Function) })
      );

      unmount();
      expect(setControls).toHaveBeenCalledWith(null);
    });
  });
});
