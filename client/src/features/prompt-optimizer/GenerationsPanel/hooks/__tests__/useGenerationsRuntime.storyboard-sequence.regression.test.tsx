import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VIDEO_DRAFT_MODEL } from '@/components/ToolSidebar/config/modelConfig';
import { useGenerationsRuntime } from '../useGenerationsRuntime';
import type { CapabilitiesSchema } from '@shared/capabilities';
import type { ExtendVideoSource } from '@/features/prompt-optimizer/context/generationControlsStoreTypes';

const setControlsMock = vi.fn();
const updateShotMock = vi.fn().mockResolvedValue(undefined);
const generateShotMock = vi.fn().mockResolvedValue(undefined);
const generateStoryboardMock = vi.fn();
const onCreateVersionIfNeededMock = vi.fn(() => 'version-1');
const dispatchMock = vi.fn();
const removeGenerationMock = vi.fn();
const setActiveGenerationMock = vi.fn();
const retryGenerationMock = vi.fn();
const cancelGenerationMock = vi.fn();
const generateDraftMock = vi.fn();
const generateRenderMock = vi.fn();
const navigateMock = vi.fn();
const toastWarningMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const clearExtendVideoMock = vi.fn();
let mockSelectedModel = 'sora-2';
let mockExtendVideo: ExtendVideoSource | null = null;
let mockCapabilitiesSchema: CapabilitiesSchema = {
  provider: 'generic',
  model: 'sora-2',
  version: '1',
  fields: {
    extend_video: { type: 'bool', default: true },
  },
};

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: () => ({ balance: null }),
}));

vi.mock('@hooks/useAuthUser', () => ({
  useAuthUser: () => ({ uid: 'user-1' }),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock('@components/Toast', () => ({
  useToast: () => ({
    warning: toastWarningMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptNavigation: () => ({ navigate: navigateMock, sessionId: null }),
  usePromptSession: () => ({ currentPromptDocId: null }),
}));

vi.mock('@/features/prompt-optimizer/context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => ({
    session: { id: 'session-1' },
    isSequenceMode: false,
    hasActiveContinuityShot: true,
    isStartingSequence: false,
    startSequence: vi.fn(),
    currentShot: {
      id: 'shot-1',
      modelId: 'sora-2',
      status: 'draft',
      videoAssetId: null,
      generatedKeyframeUrl: null,
      generatedAt: null,
      userPrompt: 'Shot prompt',
      createdAt: '2026-02-20T00:00:00.000Z',
      sequenceIndex: 0,
      sessionId: 'session-1',
      continuityMode: 'none',
      styleStrength: 0.6,
      styleReferenceId: null,
    },
    generateShot: generateShotMock,
    updateShot: updateShotMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/context/GenerationControlsContext', () => ({
  useGenerationControlsContext: () => ({
    setControls: setControlsMock,
    faceSwapPreview: null,
    onInsufficientCredits: null,
  }),
}));

vi.mock('@/features/prompt-optimizer/context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => ({
    domain: {
      selectedModel: mockSelectedModel,
      keyframes: [],
      startFrame: null,
      endFrame: null,
      videoReferenceImages: [],
      extendVideo: mockExtendVideo,
      cameraMotion: null,
      subjectMotion: '',
    },
  }),
  useGenerationControlsStoreActions: () => ({
    setStartFrame: vi.fn(),
    clearStartFrame: vi.fn(),
    setExtendVideo: vi.fn(),
    clearExtendVideo: clearExtendVideoMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/hooks/useCapabilities', () => ({
  useCapabilities: () => ({
    schema: mockCapabilitiesSchema,
    isLoading: false,
    error: null,
    target: { provider: 'generic', model: mockSelectedModel, label: 'Model' },
  }),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsState', () => ({
  useGenerationsState: () => ({
    generations: [],
    activeGenerationId: null,
    isGenerating: false,
    dispatch: dispatchMock,
    getLatestByTier: () => null,
    removeGeneration: removeGenerationMock,
    setActiveGeneration: setActiveGenerationMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions', () => ({
  useGenerationActions: () => ({
    generateDraft: generateDraftMock,
    generateRender: generateRenderMock,
    generateStoryboard: generateStoryboardMock,
    retryGeneration: retryGenerationMock,
    cancelGeneration: cancelGenerationMock,
  }),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel/hooks/useAssetReferenceImages', () => ({
  useAssetReferenceImages: () => ({ resolvedPrompt: null }),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationMediaRefresh', () => ({
  useGenerationMediaRefresh: vi.fn(),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel/hooks/useKeyframeWorkflow', () => ({
  useKeyframeWorkflow: () => ({
    keyframeStep: {
      isActive: false,
      character: null,
      pendingModel: null,
    },
    selectedFrameUrl: null,
    handleRender: vi.fn(),
    handleApproveKeyframe: vi.fn(),
    handleSkipKeyframe: vi.fn(),
    handleSelectFrame: vi.fn(),
    handleClearSelectedFrame: vi.fn(),
  }),
}));

vi.mock('@/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsTimeline', () => ({
  useGenerationsTimeline: () => [],
}));

describe('regression: preview action in continuity mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedModel = 'sora-2';
    mockExtendVideo = null;
    mockCapabilitiesSchema = {
      provider: 'generic',
      model: 'sora-2',
      version: '1',
      fields: {
        extend_video: { type: 'bool', default: true },
      },
    };
  });

  it('starts continuity shot generation when preview action is triggered', async () => {
    renderHook(() =>
      useGenerationsRuntime({
        prompt: 'Create a preview shot',
        promptVersionId: 'version-1',
        aspectRatio: '16:9',
        versions: [],
        onCreateVersionIfNeeded: onCreateVersionIfNeededMock,
        presentation: 'hero',
      })
    );

    await waitFor(() => {
      expect(setControlsMock).toHaveBeenCalled();
    });

    const controlsPayload = setControlsMock.mock.calls
      .map((call) => call[0] as { onStoryboard?: () => void } | null)
      .find((value) => Boolean(value && typeof value.onStoryboard === 'function'));

    expect(controlsPayload?.onStoryboard).toBeTypeOf('function');

    act(() => {
      controlsPayload?.onStoryboard?.();
    });

    await waitFor(() => {
      expect(onCreateVersionIfNeededMock).toHaveBeenCalledTimes(1);
      expect(updateShotMock).toHaveBeenCalledWith('shot-1', {
        modelId: VIDEO_DRAFT_MODEL.id,
      });
      expect(generateShotMock).toHaveBeenCalledWith('shot-1');
    });

    expect(generateStoryboardMock).not.toHaveBeenCalled();
  });

  it('clears extend mode when selected model does not support extend_video', async () => {
    mockSelectedModel = 'wan-2.2';
    mockExtendVideo = {
      url: 'https://example.com/video.mp4',
      source: 'generation',
      generationId: 'gen-1',
    };
    mockCapabilitiesSchema = {
      provider: 'generic',
      model: 'wan-2.2',
      version: '1',
      fields: {
        extend_video: { type: 'bool', default: false },
      },
    };

    renderHook(() =>
      useGenerationsRuntime({
        prompt: 'Extend this clip',
        promptVersionId: 'version-1',
        aspectRatio: '16:9',
        versions: [],
        onCreateVersionIfNeeded: onCreateVersionIfNeededMock,
        presentation: 'hero',
      })
    );

    await waitFor(() => {
      expect(clearExtendVideoMock).toHaveBeenCalledTimes(1);
    });
  });
});
