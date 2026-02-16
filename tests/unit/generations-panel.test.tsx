import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

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
const mockUsePromptNavigation = vi.fn();
const mockUsePromptSession = vi.fn();
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

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptNavigation: () => mockUsePromptNavigation(),
  usePromptSession: () => mockUsePromptSession(),
}));

vi.mock('@features/prompt-optimizer/context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => mockUseGenerationControlsStoreState(),
  useGenerationControlsStoreActions: () => mockUseGenerationControlsStoreActions(),
}));

vi.mock('@features/prompt-optimizer/GenerationsPanel/components/GenerationCard', () => ({
  GenerationCard: (props: {
    generation: Generation;
    onContinueSequence?: ((generation: Generation) => void) | undefined;
  }) => {
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
      faceSwapPreview: null,
      onInsufficientCredits: null,
    });
    mockUseWorkspaceSession.mockReturnValue({
      session: { id: 'session-current' },
      isSequenceMode: false,
      isStartingSequence: false,
      startSequence: vi.fn(),
      currentShot: null,
      generateShot: vi.fn(),
      updateShot: vi.fn(),
    });
    mockUsePromptNavigation.mockReturnValue({
      navigate: vi.fn(),
      sessionId: 'session-current',
    });
    mockUsePromptSession.mockReturnValue({
      currentPromptDocId: 'session-current',
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
    it('does not trigger draft generation when prompt is empty', () => {
      const generateDraft = vi.fn();
      mockUseGenerationActions.mockReturnValue({
        generateDraft,
        generateRender: vi.fn(),
        generateStoryboard: vi.fn(),
        retryGeneration: vi.fn(),
        cancelGeneration: vi.fn(),
      });
      const setControls = vi.fn();
      mockUseGenerationControlsContext.mockReturnValue({
        setControls,
        faceSwapPreview: null,
        onInsufficientCredits: null,
      });

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

      const controls = setControls.mock.calls[0]?.[0] as
        | { onDraft?: (model: string) => void }
        | null;
      expect(controls?.onDraft).toBeTypeOf('function');

      act(() => {
        controls?.onDraft?.(VIDEO_DRAFT_MODEL.id);
      });

      expect(generateDraft).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('triggers draft generation through registered controls', () => {
      const generateDraft = vi.fn();
      mockUseGenerationActions.mockReturnValue({
        generateDraft,
        generateRender: vi.fn(),
        generateStoryboard: vi.fn(),
        retryGeneration: vi.fn(),
        cancelGeneration: vi.fn(),
      });

      const onCreateVersionIfNeeded = vi.fn().mockReturnValue('version-2');
      const setControls = vi.fn();
      mockUseGenerationControlsContext.mockReturnValue({
        setControls,
        faceSwapPreview: null,
        onInsufficientCredits: null,
      });

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

      const controls = setControls.mock.calls[0]?.[0] as
        | { onDraft?: (model: string) => void }
        | null;
      expect(controls?.onDraft).toBeTypeOf('function');

      act(() => {
        controls?.onDraft?.(VIDEO_DRAFT_MODEL.id);
      });
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
        faceSwapPreview: null,
        onInsufficientCredits: null,
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

    it('uses video asset id parsed from preview URL when mediaAssetIds contains a storage path', async () => {
      const startSequence = vi.fn().mockResolvedValue({ sessionId: 'sequence-1', shot: { id: 'shot-1' } });
      mockUseWorkspaceSession.mockReturnValue({
        session: { id: 'session-current' },
        isSequenceMode: false,
        isStartingSequence: false,
        startSequence,
        currentShot: null,
        generateShot: vi.fn(),
        updateShot: vi.fn(),
      });
      mockUseGenerationsTimeline.mockReturnValue([
        {
          type: 'generation',
          generation: createGeneration({
            id: 'gen-seq-1',
            mediaUrls: ['https://example.com/api/preview/video/content/asset-123/stream.m3u8'],
            mediaAssetIds: ['users/user-1/generations/video.mp4'],
          }),
          timestamp: 1,
        },
      ]);

      render(
        <GenerationsPanel
          prompt="Prompt"
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={vi.fn()}
        />
      );

      const firstCardProps = generationCardSpy.mock.calls[0]?.[0] as
        | {
            generation: Generation;
            onContinueSequence?: ((generation: Generation) => Promise<void>) | undefined;
          }
        | undefined;
      expect(firstCardProps?.onContinueSequence).toBeTypeOf('function');

      await act(async () => {
        await firstCardProps?.onContinueSequence?.(firstCardProps.generation);
      });

      expect(startSequence).toHaveBeenCalledWith({
        sourceVideoId: 'asset-123',
        prompt: 'Prompt',
        originSessionId: 'session-current',
      });
    });

    it('falls back to storage path when no asset id is available', async () => {
      const startSequence = vi.fn().mockResolvedValue({ sessionId: 'sequence-2', shot: { id: 'shot-2' } });
      mockUseWorkspaceSession.mockReturnValue({
        session: { id: 'session-current' },
        isSequenceMode: false,
        isStartingSequence: false,
        startSequence,
        currentShot: null,
        generateShot: vi.fn(),
        updateShot: vi.fn(),
      });
      mockUseGenerationsTimeline.mockReturnValue([
        {
          type: 'generation',
          generation: createGeneration({
            id: 'gen-seq-2',
            mediaUrls: [
              'https://storage.googleapis.com/example-bucket/users%2Fuser-1%2Fgeneration%2Fvideo.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=abc',
            ],
            mediaAssetIds: ['users/user-1/generations/video.mp4'],
          }),
          timestamp: 2,
        },
      ]);

      render(
        <GenerationsPanel
          prompt="Prompt"
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={vi.fn()}
        />
      );

      const firstCardProps = generationCardSpy.mock.calls[0]?.[0] as
        | {
            generation: Generation;
            onContinueSequence?: ((generation: Generation) => Promise<void>) | undefined;
          }
        | undefined;
      expect(firstCardProps?.onContinueSequence).toBeTypeOf('function');

      await act(async () => {
        await firstCardProps?.onContinueSequence?.(firstCardProps.generation);
      });

      expect(startSequence).toHaveBeenCalledWith({
        sourceVideoId: 'users/user-1/generations/video.mp4',
        prompt: 'Prompt',
        originSessionId: 'session-current',
      });
    });

    it('does not navigate into sequence if user changes sessions before sequence startup resolves', async () => {
      let resolveStartSequence: ((value: { sessionId: string; shot: { id: string } }) => void) | null = null;
      const startSequence = vi.fn().mockImplementation(
        () =>
          new Promise<{ sessionId: string; shot: { id: string } }>((resolve) => {
            resolveStartSequence = resolve;
          })
      );
      mockUseWorkspaceSession.mockReturnValue({
        session: { id: 'session-current' },
        isSequenceMode: false,
        isStartingSequence: false,
        startSequence,
        currentShot: null,
        generateShot: vi.fn(),
        updateShot: vi.fn(),
      });
      mockUseGenerationsTimeline.mockReturnValue([
        {
          type: 'generation',
          generation: createGeneration({
            id: 'gen-seq-race',
            mediaUrls: ['https://example.com/api/preview/video/content/asset-123/stream.m3u8'],
            mediaAssetIds: ['users/user-1/generations/video.mp4'],
          }),
          timestamp: 3,
        },
      ]);

      const navigate = vi.fn();
      mockUsePromptNavigation.mockReturnValue({
        navigate,
        sessionId: 'session-current',
      });

      const view = render(
        <GenerationsPanel
          prompt="Prompt"
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={vi.fn()}
        />
      );

      const firstCardProps = generationCardSpy.mock.calls[0]?.[0] as
        | {
            generation: Generation;
            onContinueSequence?: ((generation: Generation) => Promise<void>) | undefined;
          }
        | undefined;
      expect(firstCardProps?.onContinueSequence).toBeTypeOf('function');

      const pendingContinue = firstCardProps?.onContinueSequence?.(firstCardProps.generation);

      mockUsePromptNavigation.mockReturnValue({
        navigate,
        sessionId: 'session-other',
      });
      view.rerender(
        <GenerationsPanel
          prompt="Prompt"
          promptVersionId="version-1"
          aspectRatio="16:9"
          versions={[]}
          onRestoreVersion={vi.fn()}
          onCreateVersionIfNeeded={vi.fn()}
        />
      );

      await act(async () => {
        resolveStartSequence?.({ sessionId: 'sequence-3', shot: { id: 'shot-3' } });
        await pendingContinue;
      });

      expect(navigate).not.toHaveBeenCalledWith('/session/sequence-3?originSessionId=session-current');
    });
  });
});
