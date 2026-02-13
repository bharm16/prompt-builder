import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContinuityShot } from '@/features/continuity/types';
import type { CameraPath } from '@/features/convergence/types';
import { SequenceWorkspace } from '../SequenceWorkspace';

const setCameraMotionMock = vi.fn();

const cameraPathSelection: CameraPath = {
  id: 'dolly-in',
  label: 'Dolly In',
  category: 'dolly',
  start: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  end: {
    position: { x: 0, y: 0, z: -2 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  duration: 4,
};

vi.mock(
  '@components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter',
  () => ({
    GenerationFooter: () => <div data-testid="generation-footer" />,
  })
);

vi.mock('@components/ToolSidebar/components/panels/GenerationControlsPanel/components/VideoSettingsRow', () => ({
  VideoSettingsRow: ({
    onOpenMotion,
    isMotionDisabled,
  }: {
    onOpenMotion?: () => void;
    isMotionDisabled?: boolean;
  }) => (
    <button
      type="button"
      data-testid="motion-trigger"
      onClick={onOpenMotion}
      disabled={Boolean(isMotionDisabled)}
    >
      Motion
    </button>
  ),
}));

vi.mock('@components/modals/CameraMotionModal', () => ({
  CameraMotionModal: ({
    isOpen,
    onSelect,
  }: {
    isOpen: boolean;
    onSelect: (path: CameraPath) => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        data-testid="camera-motion-select"
        onClick={() => onSelect(cameraPathSelection)}
      >
        Select camera motion
      </button>
    ) : null,
}));

vi.mock(
  '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping',
  () => ({
    useCapabilitiesClamping: () => ({
      aspectRatioInfo: { state: { disabled: false } },
      durationInfo: { state: { disabled: false } },
      aspectRatioOptions: ['16:9'],
      durationOptions: [5],
    }),
  })
);

vi.mock(
  '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation',
  () => ({
    useModelSelectionRecommendation: () => ({
      modelRecommendation: null,
      recommendedModelId: undefined,
      efficientModelId: undefined,
      renderModelOptions: [{ id: 'wan-2.5', label: 'Wan 2.5' }],
      renderModelId: 'wan-2.5',
    }),
  })
);

vi.mock('@/features/prompt-optimizer/context/PromptStateContext', () => ({
  useOptionalPromptHighlights: () => null,
}));

vi.mock('@/features/prompt-optimizer/context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => ({
    domain: {
      selectedModel: 'wan-2.5',
      videoTier: 'render',
      keyframes: [],
      generationParams: {
        aspect_ratio: '16:9',
        duration_s: 5,
      },
      cameraMotion: null,
    },
  }),
  useGenerationControlsStoreActions: () => ({
    setSelectedModel: vi.fn(),
    setVideoTier: vi.fn(),
    mergeGenerationParams: vi.fn(),
    setCameraMotion: setCameraMotionMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/hooks/useClipboard', () => ({
  useClipboard: () => ({
    copy: vi.fn(),
  }),
}));

const useWorkspaceSessionMock = vi.fn();

vi.mock('@/features/prompt-optimizer/context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => useWorkspaceSessionMock(),
}));

vi.mock('../ContinuityIntentPicker', () => ({
  ContinuityIntentPicker: () => <div data-testid="continuity-intent" />,
}));

vi.mock('../PipelineStatus', () => ({
  PipelineStatus: () => <div data-testid="pipeline-status" />,
}));

vi.mock('../PreviousShotContext', () => ({
  PreviousShotContext: () => <div data-testid="previous-shot-context" />,
}));

vi.mock('../ShotVisualStrip', () => ({
  ShotVisualStrip: () => <div data-testid="shot-visual-strip" />,
}));

const buildShot = (overrides: Partial<ContinuityShot>): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Shot prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'wan-2.5',
  status: 'draft',
  createdAt: '2026-02-12T00:00:00.000Z',
  ...overrides,
});

describe('SequenceWorkspace', () => {
  beforeEach(() => {
    setCameraMotionMock.mockReset();
    useWorkspaceSessionMock.mockReset();

    const shotOne = buildShot({
      id: 'shot-1',
      sequenceIndex: 0,
      frameBridge: {
        id: 'bridge-1',
        sourceVideoId: 'video-1',
        sourceShotId: 'shot-0',
        frameUrl: 'https://img.example.com/shot-1-last-frame.png',
        framePosition: 'last',
        frameTimestamp: 3.2,
        resolution: { width: 1280, height: 720 },
        aspectRatio: '16:9',
        extractedAt: '2026-02-12T00:00:00.000Z',
      },
    });
    const shotTwo = buildShot({
      id: 'shot-2',
      sequenceIndex: 1,
      userPrompt: 'Second shot prompt',
    });

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'session-1',
        name: 'Continuity Session',
      },
      shots: [shotOne, shotTwo],
      currentShotId: 'shot-2',
      currentShot: shotTwo,
      currentShotIndex: 1,
      setCurrentShotId: vi.fn(),
      updateShot: vi.fn(),
      generateShot: vi.fn(async () => shotTwo),
    });
  });

  it('enables camera motion when a continuity frame source exists', () => {
    render(
      <SequenceWorkspace
        promptText="Second shot prompt"
        onPromptChange={vi.fn()}
        isOptimizing={false}
        onAiEnhance={vi.fn()}
        onAddShot={vi.fn()}
      />
    );

    expect(screen.getByTestId('motion-trigger')).toBeEnabled();
  });

  it('opens camera motion modal and saves selected motion', async () => {
    const user = userEvent.setup();

    render(
      <SequenceWorkspace
        promptText="Second shot prompt"
        onPromptChange={vi.fn()}
        isOptimizing={false}
        onAiEnhance={vi.fn()}
        onAddShot={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('motion-trigger'));
    await user.click(screen.getByTestId('camera-motion-select'));

    expect(setCameraMotionMock).toHaveBeenCalledWith(cameraPathSelection);
  });
});
