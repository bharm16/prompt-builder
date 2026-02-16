import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GenerationControlsProvider } from '@/features/prompt-optimizer/context/GenerationControlsContext';
import { GenerationControlsStoreProvider } from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { GenerationControlsPanel } from '../GenerationControlsPanel';

const useCreditBalanceMock = vi.fn();
const useGenerationControlsPanelMock = vi.fn();

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: () => useCreditBalanceMock(),
}));

vi.mock('@/features/model-intelligence/api', () => ({
  trackModelRecommendationEvent: vi.fn(),
}));

vi.mock('@/components/modals/CameraMotionModal', () => ({
  CameraMotionModal: () => null,
}));

vi.mock('@/components/modals/FaceSwapPreviewModal', () => ({
  FaceSwapPreviewModal: () => null,
}));

vi.mock('../hooks/useGenerationControlsPanel', () => ({
  useGenerationControlsPanel: (...args: unknown[]) => useGenerationControlsPanelMock(...args),
}));

const buildHookResult = () => ({
  refs: {
    fileInputRef: { current: null },
    startFrameFileInputRef: { current: null },
  },
  state: {
    activeTab: 'video',
    imageSubTab: 'references',
    showCameraMotionModal: false,
  },
  store: {
    aspectRatio: '16:9',
    duration: 5,
    selectedModel: 'sora-2',
    tier: 'render',
    keyframes: [],
    startFrame: null,
    cameraMotion: null,
  },
  derived: {
    isOptimizing: false,
    hasStartFrame: false,
    isKeyframeLimitReached: false,
    isUploadDisabled: false,
    isStartFrameUploadDisabled: false,
    startFrameUrlHost: null,
    hasPrompt: true,
    promptLength: 40,
    isImageGenerateDisabled: false,
    isVideoGenerateDisabled: false,
    isStoryboardDisabled: false,
    isGenerateDisabled: false,
    canPreviewFaceSwap: false,
    isFaceSwapPreviewDisabled: true,
  },
  faceSwap: {
    mode: 'direct',
    selectedCharacterId: '',
    characterOptions: [],
    previewUrl: null,
    isPreviewReady: false,
    isLoading: false,
    error: null,
    isModalOpen: false,
    faceSwapCredits: 1,
    videoCredits: null,
    totalCredits: null,
  },
  recommendation: {
    recommendationMode: 't2v',
    modelRecommendation: null,
    isRecommendationLoading: false,
    recommendationError: null,
    recommendedModelId: undefined,
    efficientModelId: undefined,
    renderModelOptions: [{ id: 'sora-2', label: 'Sora' }],
    renderModelId: 'sora-2',
    recommendationAgeMs: null,
  },
  capabilities: {
    aspectRatioInfo: null,
    durationInfo: null,
    aspectRatioOptions: ['16:9'],
    durationOptions: [5],
  },
  actions: {
    setActiveTab: vi.fn(),
    setImageSubTab: vi.fn(),
    handleModelChange: vi.fn(),
    handleAspectRatioChange: vi.fn(),
    handleDurationChange: vi.fn(),
    handleTierChange: vi.fn(),
    handleRemoveKeyframe: vi.fn(),
    handleFile: vi.fn(),
    handleUploadRequest: vi.fn(),
    handleStartFrameFile: vi.fn(),
    handleStartFrameUploadRequest: vi.fn(),
    handleClearStartFrame: vi.fn(),
    handleCameraMotionButtonClick: vi.fn(),
    handleCloseCameraMotionModal: vi.fn(),
    handleSelectCameraMotion: vi.fn(),
    handleCopy: vi.fn(),
    handleClearPrompt: vi.fn(),
    setFaceSwapMode: vi.fn(),
    setFaceSwapCharacterId: vi.fn(),
    handleFaceSwapPreview: vi.fn(),
    handleOpenFaceSwapModal: vi.fn(),
    handleCloseFaceSwapModal: vi.fn(),
    handleFaceSwapTryDifferent: vi.fn(),
  },
});

const renderPanel = (props: {
  onDraft?: ReturnType<typeof vi.fn>;
  onRender?: ReturnType<typeof vi.fn>;
  onStoryboard?: ReturnType<typeof vi.fn>;
}) => {
  const onDraft = props.onDraft ?? vi.fn();
  const onRender = props.onRender ?? vi.fn();
  const onStoryboard = props.onStoryboard ?? vi.fn();

  render(
    <MemoryRouter>
      <GenerationControlsStoreProvider>
        <GenerationControlsProvider>
          <GenerationControlsPanel
            onDraft={onDraft}
            onRender={onRender}
            onStoryboard={onStoryboard}
          />
        </GenerationControlsProvider>
      </GenerationControlsStoreProvider>
    </MemoryRouter>
  );

  return { onDraft, onRender, onStoryboard };
};

describe('GenerationControlsPanel credit gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreditBalanceMock.mockReturnValue({
      balance: 0,
      isLoading: false,
      error: null,
    });
    useGenerationControlsPanelMock.mockReturnValue(buildHookResult());
  });

  it('disables generate when balance is insufficient and blocks generation', () => {
    const { onDraft, onRender } = renderPanel({});
    const generateButton = screen.getByRole('button', { name: /^Generate$/i });

    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveAttribute(
      'title',
      expect.stringContaining('you have 0')
    );

    fireEvent.click(generateButton);

    expect(onDraft).not.toHaveBeenCalled();
    expect(onRender).not.toHaveBeenCalled();
    expect(screen.queryByText('Insufficient Credits')).not.toBeInTheDocument();
  });

  it('blocks storyboard preview action when balance is insufficient', () => {
    const { onStoryboard } = renderPanel({});

    fireEvent.click(screen.getByLabelText('Generate 1 preview · 1 cr'));

    expect(onStoryboard).not.toHaveBeenCalled();
    expect(screen.getByText(/This Storyboard costs/i)).toBeInTheDocument();
  });
});
