import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GenerationsPanel } from '../GenerationsPanel';
import type { Generation } from '../types';

const setControlsSpy = vi.hoisted(() => vi.fn());
const removeGenerationSpy = vi.hoisted(() => vi.fn());
const dispatchSpy = vi.hoisted(() => vi.fn());
const generation = vi.hoisted<Generation>(() => ({
  id: 'generation-1',
  tier: 'draft',
  status: 'completed',
  model: 'wan-2.5',
  prompt: 'A cinematic sunset',
  promptVersionId: 'version-1',
  createdAt: 123,
  completedAt: 456,
  mediaType: 'video',
  mediaUrls: ['https://example.com/video.mp4'],
}));

vi.mock('../hooks/useGenerationsState', () => ({
  useGenerationsState: () => ({
    generations: [generation],
    activeGenerationId: generation.id,
    isGenerating: false,
    dispatch: dispatchSpy,
    getLatestByTier: () => ({ model: generation.model }),
    removeGeneration: removeGenerationSpy,
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

describe('GenerationsPanel hero presentation', () => {
  it('renders hero generation card and emits state snapshot', async () => {
    const onStateSnapshot = vi.fn();

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

    expect(screen.getByTestId('hero-generation-card')).toBeInTheDocument();

    await waitFor(() => {
      expect(onStateSnapshot).toHaveBeenCalledWith({
        generations: [generation],
        activeGenerationId: generation.id,
        isGenerating: false,
        selectedFrameUrl: null,
      });
    });
  });
});
