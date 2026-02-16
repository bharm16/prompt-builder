import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GenerationsPanel } from '../GenerationsPanel';
import type { Generation } from '../types';

const setControlsSpy = vi.hoisted(() => vi.fn());
const removeGenerationSpy = vi.hoisted(() => vi.fn());
const dispatchSpy = vi.hoisted(() => vi.fn());
const setActiveGenerationSpy = vi.hoisted(() => vi.fn());
const mockedGenerationsState = vi.hoisted(() => ({
  generations: [] as Generation[],
  activeGenerationId: null as string | null,
  isGenerating: false,
  latestModel: 'wan-2.5',
}));

vi.mock('../hooks/useGenerationsState', () => ({
  useGenerationsState: () => ({
    generations: mockedGenerationsState.generations,
    activeGenerationId: mockedGenerationsState.activeGenerationId,
    isGenerating: mockedGenerationsState.isGenerating,
    dispatch: dispatchSpy,
    getLatestByTier: () => ({ model: mockedGenerationsState.latestModel }),
    removeGeneration: removeGenerationSpy,
    setActiveGeneration: setActiveGenerationSpy,
  }),
}));

vi.mock('../hooks/useGenerationActions', () => ({
  useGenerationActions: () => ({
    generateDraft: vi.fn(),
    generateRender: vi.fn(),
    generateStoryboard: vi.fn(),
    retryGeneration: vi.fn(),
    cancelGeneration: vi.fn(),
  }),
}));

vi.mock('../hooks/useGenerationsTimeline', () => ({
  useGenerationsTimeline: () => [],
}));

vi.mock('../hooks/useAssetReferenceImages', () => ({
  useAssetReferenceImages: () => ({ resolvedPrompt: null }),
}));

vi.mock('../hooks/useGenerationMediaRefresh', () => ({
  useGenerationMediaRefresh: () => undefined,
}));

vi.mock('../hooks/useKeyframeWorkflow', () => ({
  useKeyframeWorkflow: () => ({
    keyframeStep: { isActive: false, character: null },
    selectedFrameUrl: null,
    handleRender: vi.fn(),
    handleApproveKeyframe: vi.fn(),
    handleSkipKeyframe: vi.fn(),
    handleSelectFrame: vi.fn(),
    handleClearSelectedFrame: vi.fn(),
  }),
}));

vi.mock('../../context/GenerationControlsContext', () => ({
  useGenerationControlsContext: () => ({
    setControls: setControlsSpy,
    faceSwapPreview: null,
    onInsufficientCredits: null,
  }),
}));

vi.mock('../../context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => ({
    domain: {
      keyframes: [],
      startFrame: null,
      cameraMotion: null,
      subjectMotion: '',
    },
  }),
  useGenerationControlsStoreActions: () => ({
    setStartFrame: vi.fn(),
    clearStartFrame: vi.fn(),
  }),
}));

vi.mock('../../context/PromptStateContext', () => ({
  usePromptNavigation: () => ({ navigate: vi.fn(), sessionId: 'session-1' }),
  usePromptSession: () => ({ currentPromptDocId: 'prompt-doc-1' }),
}));

vi.mock('../../context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => ({
    session: null,
    isSequenceMode: false,
    hasActiveContinuityShot: false,
    isStartingSequence: false,
    startSequence: vi.fn(),
    currentShot: null,
    generateShot: vi.fn(),
    updateShot: vi.fn(),
  }),
}));

vi.mock('@components/Toast', () => ({
  useToast: () => ({
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../components/GenerationCard', () => ({
  GenerationCard: ({ generation: cardGeneration }: { generation: Generation }) => (
    <div data-testid="hero-generation-card">{cardGeneration.id}</div>
  ),
}));

const createGeneration = ({
  id,
  mediaType,
  model,
}: {
  id: string;
  mediaType: Generation['mediaType'];
  model?: string | undefined;
}): Generation => {
  const isImageSequence = mediaType === 'image-sequence';
  return {
    id,
    tier: 'draft',
    status: 'completed',
    model: model ?? (isImageSequence ? 'flux-kontext' : 'wan-2.5'),
    prompt: `Prompt for ${id}`,
    promptVersionId: 'version-1',
    createdAt: 123,
    completedAt: 456,
    mediaType,
    mediaUrls: isImageSequence
      ? [
          'https://example.com/frame-1.png',
          'https://example.com/frame-2.png',
          'https://example.com/frame-3.png',
          'https://example.com/frame-4.png',
        ]
      : ['https://example.com/video.mp4'],
    ...(isImageSequence ? { mediaAssetIds: ['asset-1', 'asset-2', 'asset-3', 'asset-4'] } : {}),
  };
};

describe('GenerationsPanel hero presentation', () => {
  beforeEach(() => {
    setControlsSpy.mockClear();
    setActiveGenerationSpy.mockClear();
    mockedGenerationsState.generations = [];
    mockedGenerationsState.activeGenerationId = null;
    mockedGenerationsState.isGenerating = false;
    mockedGenerationsState.latestModel = 'wan-2.5';
  });

  it('shows video generation when image-sequence is active and preserves active snapshot id', async () => {
    const onStateSnapshot = vi.fn();
    const videoGeneration = createGeneration({
      id: 'video-generation-1',
      mediaType: 'video',
      model: 'wan-2.5',
    });
    const storyboardGeneration = createGeneration({
      id: 'storyboard-generation-1',
      mediaType: 'image-sequence',
      model: 'flux-kontext',
    });

    mockedGenerationsState.generations = [videoGeneration, storyboardGeneration];
    mockedGenerationsState.activeGenerationId = storyboardGeneration.id;
    mockedGenerationsState.latestModel = videoGeneration.model;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
        onStateSnapshot={onStateSnapshot}
      />
    );

    expect(screen.getByTestId('hero-generation-card')).toHaveTextContent(videoGeneration.id);
    expect(screen.queryByText(storyboardGeneration.id)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(onStateSnapshot).toHaveBeenCalledWith({
        generations: [videoGeneration, storyboardGeneration],
        activeGenerationId: storyboardGeneration.id,
        isGenerating: false,
        selectedFrameUrl: null,
      });
    });
  });

  it('shows empty state when only image-sequence generations exist', () => {
    const storyboardGeneration = createGeneration({
      id: 'storyboard-only-1',
      mediaType: 'image-sequence',
      model: 'flux-kontext',
    });

    mockedGenerationsState.generations = [storyboardGeneration];
    mockedGenerationsState.activeGenerationId = storyboardGeneration.id;
    mockedGenerationsState.latestModel = storyboardGeneration.model;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
      />
    );

    expect(screen.queryByTestId('hero-generation-card')).not.toBeInTheDocument();
    expect(screen.queryByText('No outputs yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run Draft' })).not.toBeInTheDocument();
  });

  it('shows active video generation in hero mode when no image-sequences exist', () => {
    const videoGeneration = createGeneration({
      id: 'video-only-1',
      mediaType: 'video',
      model: 'wan-2.5',
    });

    mockedGenerationsState.generations = [videoGeneration];
    mockedGenerationsState.activeGenerationId = videoGeneration.id;
    mockedGenerationsState.latestModel = videoGeneration.model;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
      />
    );

    expect(screen.getByTestId('hero-generation-card')).toHaveTextContent(videoGeneration.id);
  });

  it('does not mark controls as generating when only storyboard jobs are in progress in hero mode', async () => {
    const videoGeneration = createGeneration({
      id: 'video-idle-1',
      mediaType: 'video',
      model: 'wan-2.5',
    });
    const storyboardGenerating = {
      ...createGeneration({
        id: 'storyboard-generating-1',
        mediaType: 'image-sequence',
        model: 'flux-kontext',
      }),
      status: 'generating' as const,
      completedAt: null,
      mediaUrls: [],
    };

    mockedGenerationsState.generations = [videoGeneration, storyboardGenerating];
    mockedGenerationsState.activeGenerationId = storyboardGenerating.id;
    mockedGenerationsState.isGenerating = true;
    mockedGenerationsState.latestModel = videoGeneration.model;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
      />
    );

    await waitFor(() => {
      const nonNullCalls = setControlsSpy.mock.calls
        .map((call) => call[0])
        .filter((value) => value !== null);
      const latestControls = nonNullCalls[nonNullCalls.length - 1] as
        | { isGenerating: boolean }
        | undefined;
      expect(latestControls?.isGenerating).toBe(false);
    });
  });
});
