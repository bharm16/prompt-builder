import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  GenerationControlsProvider,
  useGenerationControlsContext,
} from '@/features/prompt-optimizer/context/GenerationControlsContext';
import { GenerationControlsStoreProvider } from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { GenerationControlsPanel } from '../GenerationControlsPanel';
import * as creditGateHook from '@/hooks/useCreditGate';

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
    endFrameFileInputRef: { current: null },
    videoReferenceFileInputRef: { current: null },
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
    endFrame: null,
    videoReferenceImages: [],
    extendVideo: null,
    cameraMotion: null,
  },
  derived: {
    isOptimizing: false,
    hasStartFrame: false,
    hasEndFrame: false,
    isExtendMode: false,
    videoReferenceCount: 0,
    isKeyframeLimitReached: false,
    isVideoReferenceLimitReached: false,
    isUploadDisabled: false,
    isStartFrameUploadDisabled: false,
    isEndFrameUploadDisabled: false,
    isVideoReferenceUploadDisabled: false,
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
    videoInputCapabilities: {
      supportsStartFrame: true,
      supportsEndFrame: false,
      supportsReferenceImages: false,
      supportsExtendVideo: false,
      maxReferenceImages: 0,
    },
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
    handleEndFrameFile: vi.fn(),
    handleEndFrameUploadRequest: vi.fn(),
    handleClearEndFrame: vi.fn(),
    handleVideoReferenceFile: vi.fn(),
    handleVideoReferenceUploadRequest: vi.fn(),
    handleRemoveVideoReference: vi.fn(),
    handleUpdateVideoReferenceType: vi.fn(),
    handleClearExtendVideo: vi.fn(),
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

function OnInsufficientCreditsObserver({
  onChange,
}: {
  onChange: (handler: ((required: number, operation: string) => void) | null) => void;
}): React.ReactElement {
  const { onInsufficientCredits } = useGenerationControlsContext();

  React.useEffect(() => {
    onChange(onInsufficientCredits);
  }, [onChange, onInsufficientCredits]);

  return <></>;
}

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

  it('does not churn insufficient-credit registration when open callback identity changes', async () => {
    const useCreditGateSpy = vi.spyOn(creditGateHook, 'useCreditGate');
    const onInsufficientCreditsChange = vi.fn();
    const onDraft = vi.fn();
    const onRender = vi.fn();
    const onStoryboard = vi.fn();

    useCreditGateSpy.mockImplementation(() => ({
      checkCredits: vi.fn(() => true),
      openInsufficientCredits: vi.fn(),
      insufficientCreditsModal: null,
      dismissModal: vi.fn(),
      balance: 200,
      isLoading: false,
    }));

    const renderTree = (): React.ReactElement => (
      <MemoryRouter>
        <GenerationControlsStoreProvider>
          <GenerationControlsProvider>
            <OnInsufficientCreditsObserver onChange={onInsufficientCreditsChange} />
            <GenerationControlsPanel
              onDraft={onDraft}
              onRender={onRender}
              onStoryboard={onStoryboard}
              isProcessing={false}
              isRefining={false}
              assets={[]}
              onBack={() => undefined}
            />
          </GenerationControlsProvider>
        </GenerationControlsStoreProvider>
      </MemoryRouter>
    );

    const { rerender } = render(renderTree());

    rerender(renderTree());
    rerender(renderTree());

    await waitFor(() => {
      const nonNullHandlers = onInsufficientCreditsChange.mock.calls
        .map((call) => call[0] as ((required: number, operation: string) => void) | null)
        .filter((handler): handler is (required: number, operation: string) => void => Boolean(handler));

      expect(nonNullHandlers.length).toBeGreaterThanOrEqual(1);

      const firstHandler = nonNullHandlers[0];
      const hasIdentityChurn = nonNullHandlers.some((handler) => handler !== firstHandler);
      expect(hasIdentityChurn).toBe(false);
    });

    useCreditGateSpy.mockRestore();
  });
});
