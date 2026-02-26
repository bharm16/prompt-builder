import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
}: {
  id: string;
  mediaType: Generation['mediaType'];
}): Generation => ({
  id,
  tier: 'draft',
  status: 'completed',
  model: mediaType === 'image-sequence' ? 'flux-kontext' : 'wan-2.5',
  prompt: `Prompt for ${id}`,
  promptVersionId: 'version-1',
  createdAt: 123,
  completedAt: 456,
  mediaType,
  mediaUrls:
    mediaType === 'image-sequence'
      ? [
          'https://example.com/frame-1.png',
          'https://example.com/frame-2.png',
          'https://example.com/frame-3.png',
          'https://example.com/frame-4.png',
        ]
      : ['https://example.com/video.mp4'],
});

describe('GenerationsPanel hero override', () => {
  beforeEach(() => {
    setControlsSpy.mockClear();
    setActiveGenerationSpy.mockClear();
    mockedGenerationsState.generations = [];
    mockedGenerationsState.activeGenerationId = null;
    mockedGenerationsState.isGenerating = false;
    mockedGenerationsState.latestModel = 'wan-2.5';
  });

  it('honors heroOverrideGenerationId for non-storyboard generations', () => {
    const videoA = createGeneration({ id: 'video-a', mediaType: 'video' });
    const videoB = createGeneration({ id: 'video-b', mediaType: 'video' });
    const storyboard = createGeneration({
      id: 'storyboard-a',
      mediaType: 'image-sequence',
    });

    mockedGenerationsState.generations = [videoA, videoB, storyboard];
    mockedGenerationsState.activeGenerationId = videoA.id;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
        heroOverrideGenerationId={videoB.id}
      />
    );

    expect(screen.getByTestId('hero-generation-card')).toHaveTextContent(videoB.id);
  });

  it('ignores heroOverrideGenerationId when it points to image-sequence', () => {
    const videoA = createGeneration({ id: 'video-a', mediaType: 'video' });
    const storyboard = createGeneration({
      id: 'storyboard-a',
      mediaType: 'image-sequence',
    });

    mockedGenerationsState.generations = [videoA, storyboard];
    mockedGenerationsState.activeGenerationId = videoA.id;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
        heroOverrideGenerationId={storyboard.id}
      />
    );

    expect(screen.getByTestId('hero-generation-card')).toHaveTextContent(videoA.id);
  });

  it('falls back to existing hero selection when override is not found', () => {
    const videoA = createGeneration({ id: 'video-a', mediaType: 'video' });
    const videoB = createGeneration({ id: 'video-b', mediaType: 'video' });

    mockedGenerationsState.generations = [videoA, videoB];
    mockedGenerationsState.activeGenerationId = videoA.id;

    render(
      <GenerationsPanel
        prompt="A cinematic sunset"
        promptVersionId="version-1"
        aspectRatio="16:9"
        versions={[]}
        onRestoreVersion={vi.fn()}
        onCreateVersionIfNeeded={() => 'version-1'}
        presentation="hero"
        heroOverrideGenerationId="missing-id"
      />
    );

    expect(screen.getByTestId('hero-generation-card')).toHaveTextContent(videoA.id);
  });
});
