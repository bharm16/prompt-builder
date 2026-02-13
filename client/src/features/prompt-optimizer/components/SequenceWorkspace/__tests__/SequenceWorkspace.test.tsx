import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContinuityShot } from '@/features/continuity/types';
import type { CameraPath } from '@/features/convergence/types';
import { SequenceWorkspace } from '../SequenceWorkspace';

const setCameraMotionMock = vi.fn();
const createSceneProxyMock = vi.fn();
const previewSceneProxyMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastWarningMock = vi.fn();
const generationDomain = {
  selectedModel: 'wan-2.5',
  videoTier: 'render',
  keyframes: [],
  generationParams: {
    aspect_ratio: '16:9',
    duration_s: 5,
  },
  cameraMotion: null as CameraPath | null,
};

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

const pitchOnlyCameraPath: CameraPath = {
  id: 'pitch-up',
  label: 'Pitch Up',
  category: 'pan_tilt',
  start: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  end: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0.35, yaw: 0, roll: 0 },
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

vi.mock('@components/Toast', () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    warning: toastWarningMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => ({
    domain: generationDomain,
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
    createSceneProxyMock.mockReset();
    previewSceneProxyMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    toastWarningMock.mockReset();
    useWorkspaceSessionMock.mockReset();
    generationDomain.cameraMotion = null;

    const shotOne = buildShot({
      id: 'shot-1',
      sequenceIndex: 0,
      videoAssetId: 'users/user-1/generations/video.mp4',
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
      createSceneProxy: createSceneProxyMock,
      previewSceneProxy: previewSceneProxyMock,
      isCreatingSceneProxy: false,
      isPreviewingSceneProxy: false,
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

  it('updates shot camera and renders scene proxy preview for style-match shots', async () => {
    const user = userEvent.setup();
    const updateShotMock = vi.fn(async () => undefined);

    const shotOne = buildShot({
      id: 'shot-1',
      sequenceIndex: 0,
      videoAssetId: 'users/user-1/generations/video.mp4',
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
      continuityMode: 'style-match',
      userPrompt: 'Second shot prompt',
    });

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'session-1',
        name: 'Continuity Session',
        continuity: {
          sceneProxy: {
            id: 'proxy-1',
            status: 'ready',
          },
        },
      },
      shots: [shotOne, shotTwo],
      currentShotId: 'shot-2',
      currentShot: shotTwo,
      currentShotIndex: 1,
      setCurrentShotId: vi.fn(),
      updateShot: updateShotMock,
      generateShot: vi.fn(async () => shotTwo),
      createSceneProxy: createSceneProxyMock,
      previewSceneProxy: previewSceneProxyMock,
      isCreatingSceneProxy: false,
      isPreviewingSceneProxy: false,
    });

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

    await waitFor(() =>
      expect(updateShotMock).toHaveBeenCalledWith(
        'shot-2',
        expect.objectContaining({
          camera: expect.objectContaining({
            yaw: expect.any(Number),
            pitch: expect.any(Number),
            roll: expect.any(Number),
            dolly: expect.any(Number),
          }),
        })
      )
    );
    await waitFor(() =>
      expect(previewSceneProxyMock).toHaveBeenCalledWith(
        'shot-2',
        expect.objectContaining({
          yaw: expect.any(Number),
          pitch: expect.any(Number),
          roll: expect.any(Number),
          dolly: expect.any(Number),
        })
      )
    );
  });

  it('builds scene proxy from available source shot', async () => {
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

    await user.click(screen.getByRole('button', { name: /create scene proxy/i }));

    expect(createSceneProxyMock).toHaveBeenCalledWith({
      sourceShotId: 'shot-1',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Scene proxy is ready for continuity generation.');
  });

  it('uses generation camera motion when previewing angle without shot camera', async () => {
    const user = userEvent.setup();
    const updateShotMock = vi.fn(async () => undefined);
    generationDomain.cameraMotion = cameraPathSelection;

    const shotOne = buildShot({
      id: 'shot-1',
      sequenceIndex: 0,
      videoAssetId: 'users/user-1/generations/video.mp4',
    });
    const shotTwo = buildShot({
      id: 'shot-2',
      sequenceIndex: 1,
      continuityMode: 'style-match',
      userPrompt: 'Second shot prompt',
      camera: undefined,
    });

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'session-1',
        name: 'Continuity Session',
        continuity: {
          sceneProxy: {
            id: 'proxy-1',
            status: 'ready',
          },
        },
      },
      shots: [shotOne, shotTwo],
      currentShotId: 'shot-2',
      currentShot: shotTwo,
      currentShotIndex: 1,
      setCurrentShotId: vi.fn(),
      updateShot: updateShotMock,
      generateShot: vi.fn(async () => shotTwo),
      createSceneProxy: createSceneProxyMock,
      previewSceneProxy: previewSceneProxyMock,
      isCreatingSceneProxy: false,
      isPreviewingSceneProxy: false,
    });

    render(
      <SequenceWorkspace
        promptText="Second shot prompt"
        onPromptChange={vi.fn()}
        isOptimizing={false}
        onAiEnhance={vi.fn()}
        onAddShot={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('preview-scene-proxy-button'));

    await waitFor(() =>
      expect(updateShotMock).toHaveBeenCalledWith(
        'shot-2',
        expect.objectContaining({
          camera: expect.objectContaining({
            yaw: expect.any(Number),
            pitch: expect.any(Number),
            roll: expect.any(Number),
            dolly: expect.any(Number),
          }),
        })
      )
    );
    await waitFor(() =>
      expect(previewSceneProxyMock).toHaveBeenCalledWith(
        'shot-2',
        expect.objectContaining({
          yaw: expect.any(Number),
          pitch: expect.any(Number),
          roll: expect.any(Number),
          dolly: expect.any(Number),
        })
      )
    );
  });

  it('adds visible yaw for style-match preview when selected camera has no lateral angle', async () => {
    const user = userEvent.setup();
    const updateShotMock = vi.fn(async () => undefined);
    generationDomain.cameraMotion = pitchOnlyCameraPath;

    const shotOne = buildShot({
      id: 'shot-1',
      sequenceIndex: 0,
      videoAssetId: 'users/user-1/generations/video.mp4',
    });
    const shotTwo = buildShot({
      id: 'shot-2',
      sequenceIndex: 1,
      continuityMode: 'style-match',
      userPrompt: 'Second shot prompt',
      camera: undefined,
    });

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'session-1',
        name: 'Continuity Session',
        continuity: {
          sceneProxy: {
            id: 'proxy-1',
            status: 'ready',
          },
        },
      },
      shots: [shotOne, shotTwo],
      currentShotId: 'shot-2',
      currentShot: shotTwo,
      currentShotIndex: 1,
      setCurrentShotId: vi.fn(),
      updateShot: updateShotMock,
      generateShot: vi.fn(async () => shotTwo),
      createSceneProxy: createSceneProxyMock,
      previewSceneProxy: previewSceneProxyMock,
      isCreatingSceneProxy: false,
      isPreviewingSceneProxy: false,
    });

    render(
      <SequenceWorkspace
        promptText="Second shot prompt"
        onPromptChange={vi.fn()}
        isOptimizing={false}
        onAiEnhance={vi.fn()}
        onAddShot={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('preview-scene-proxy-button'));

    await waitFor(() =>
      expect(previewSceneProxyMock).toHaveBeenCalledWith(
        'shot-2',
        expect.objectContaining({
          yaw: 0.35,
          pitch: 0.35,
        })
      )
    );
  });

  it('falls back to reference frame when scene proxy preview image fails to load', () => {
    const shotOne = buildShot({
      id: 'shot-1',
      sequenceIndex: 0,
      videoAssetId: 'users/user-1/generations/video.mp4',
    });
    const shotTwo = buildShot({
      id: 'shot-2',
      sequenceIndex: 1,
      continuityMode: 'style-match',
      userPrompt: 'Second shot prompt',
      sceneProxyRenderUrl: 'https://img/expired-scene-proxy.png',
    });

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'session-1',
        name: 'Continuity Session',
        continuity: {
          sceneProxy: {
            id: 'proxy-1',
            status: 'ready',
            referenceFrameUrl: 'https://img/scene-proxy-reference.png',
          },
        },
      },
      shots: [shotOne, shotTwo],
      currentShotId: 'shot-2',
      currentShot: shotTwo,
      currentShotIndex: 1,
      setCurrentShotId: vi.fn(),
      updateShot: vi.fn(async () => undefined),
      generateShot: vi.fn(async () => shotTwo),
      createSceneProxy: createSceneProxyMock,
      previewSceneProxy: previewSceneProxyMock,
      isCreatingSceneProxy: false,
      isPreviewingSceneProxy: false,
    });

    render(
      <SequenceWorkspace
        promptText="Second shot prompt"
        onPromptChange={vi.fn()}
        isOptimizing={false}
        onAiEnhance={vi.fn()}
        onAddShot={vi.fn()}
      />
    );

    const image = screen.getByAltText('Scene proxy preview');
    expect(image).toHaveAttribute('src', 'https://img/expired-scene-proxy.png');

    fireEvent.error(image);

    expect(screen.getByAltText('Scene proxy preview')).toHaveAttribute(
      'src',
      'https://img/scene-proxy-reference.png'
    );
  });
});
