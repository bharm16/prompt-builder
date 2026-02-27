import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CapabilitiesSchema } from '@shared/capabilities';

import { GenerationControlsPanel } from '@components/ToolSidebar/components/panels/GenerationControlsPanel';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import {
  GenerationControlsStoreProvider,
} from '@features/prompt-optimizer/context/GenerationControlsStore';
import type { GenerationControlsState } from '@features/prompt-optimizer/context/generationControlsStoreTypes';

vi.mock(
  '@utils/cn',
  () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' '),
  })
);

const useCapabilitiesMock = vi.hoisted(() => vi.fn());
const useWorkspaceSessionMock = vi.hoisted(() => vi.fn());
const useGenerationControlsContextMock = vi.hoisted(() => vi.fn());
const usePromptServicesMock = vi.hoisted(() => vi.fn());
const useCreditBalanceMock = vi.hoisted(() => vi.fn());
const useLowBalanceWarningMock = vi.hoisted(() => vi.fn());

vi.mock('@features/prompt-optimizer/hooks/useCapabilities', () => ({
  useCapabilities: (...args: unknown[]) => useCapabilitiesMock(...args),
}));

vi.mock('@features/prompt-optimizer/context/GenerationControlsContext', () => ({
  useGenerationControlsContext: (...args: unknown[]) =>
    useGenerationControlsContextMock(...args),
}));

vi.mock('@features/prompt-optimizer/context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: (...args: unknown[]) => useWorkspaceSessionMock(...args),
}));

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptServices: (...args: unknown[]) => usePromptServicesMock(...args),
  useOptionalPromptHighlights: () => null,
}));

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: (...args: unknown[]) => useCreditBalanceMock(...args),
}));

vi.mock('@/features/billing/hooks/useLowBalanceWarning', () => ({
  useLowBalanceWarning: (...args: unknown[]) => useLowBalanceWarningMock(...args),
}));

vi.mock('@/hooks/useAuthUser', () => ({
  useAuthUser: () => ({ uid: 'user-1' }),
}));

const createKeyframe = (overrides: Partial<KeyframeTile> = {}): KeyframeTile => ({
  id: overrides.id ?? 'frame-1',
  url: overrides.url ?? 'https://example.com/frame.jpg',
  source: overrides.source ?? 'upload',
  ...(overrides.assetId === undefined ? {} : { assetId: overrides.assetId }),
});

const createProps = (overrides = {}) => ({
  prompt: 'A sample prompt',
  onPromptChange: vi.fn(),
  aspectRatio: '16:9',
  duration: 5,
  selectedModel: VIDEO_RENDER_MODELS[0]?.id ?? 'sora-2',
  onModelChange: vi.fn(),
  onAspectRatioChange: vi.fn(),
  onDurationChange: vi.fn(),
  onDraft: vi.fn(),
  onRender: vi.fn(),
  isDraftDisabled: false,
  isRenderDisabled: false,
  onImageUpload: vi.fn(),
  keyframes: [] as KeyframeTile[],
  onAddKeyframe: vi.fn(),
  onRemoveKeyframe: vi.fn(),
  onClearKeyframes: vi.fn(),
  tier: 'render' as const,
  onTierChange: vi.fn(),
  onStoryboard: vi.fn(),
  activeDraftModel: null,
  onBack: vi.fn(),
  ...overrides,
});

const createInitialStoreState = (
  props: ReturnType<typeof createProps>
): GenerationControlsState => ({
  domain: {
    selectedModel: props.selectedModel,
    generationParams: {
      aspect_ratio: props.aspectRatio,
      duration_s: props.duration,
    },
    videoTier: props.tier,
    keyframes: props.keyframes,
    startFrame: props.keyframes[0] ?? null,
    endFrame: null,
    videoReferenceImages: [],
    extendVideo: null,
    cameraMotion: null,
    subjectMotion: '',
  },
  ui: {
    activeTab: 'video',
    imageSubTab: 'references',
    constraintMode: 'strict',
  },
});

const renderPanel = (overrides: Parameters<typeof createProps>[0] = {}) => {
  const props = createProps(overrides);
  const initialState = createInitialStoreState(props);
  usePromptServicesMock.mockReturnValue({
    promptOptimizer: {
      inputPrompt: props.prompt,
      setInputPrompt: vi.fn(),
    },
  });

  const rendered = render(
    <GenerationControlsStoreProvider initialState={initialState}>
      <GenerationControlsPanel {...props} />
    </GenerationControlsStoreProvider>
  );

  return { ...rendered, props };
};

describe('GenerationControlsPanel', () => {
  beforeEach(() => {
    usePromptServicesMock.mockReset();
    useLowBalanceWarningMock.mockReset();
    useCreditBalanceMock.mockReturnValue({
      balance: 1000,
      isLoading: false,
      error: null,
    });
    useCapabilitiesMock.mockReturnValue({
      schema: null,
      isLoading: false,
      error: null,
      target: { provider: 'mock', model: 'mock', label: 'Mock' },
    });
    useWorkspaceSessionMock.mockReturnValue({
      session: null,
      loading: false,
      error: null,
      isSequenceMode: false,
      shots: [],
      currentShotId: null,
      currentShot: null,
      currentShotIndex: -1,
      setCurrentShotId: vi.fn(),
      refreshSession: vi.fn(),
      addShot: vi.fn(),
      updateShot: vi.fn(),
      updateShotStyleReference: vi.fn(),
      generateShot: vi.fn(),
      startSequence: vi.fn(),
      isStartingSequence: false,
    });
    useGenerationControlsContextMock.mockReturnValue({
      controls: {
        onDraft: vi.fn(),
        onRender: vi.fn(),
        onStoryboard: vi.fn(),
        isGenerating: false,
        activeDraftModel: null,
      },
      setControls: vi.fn(),
      onStoryboard: vi.fn(),
      onInsufficientCredits: null,
      setOnInsufficientCredits: vi.fn(),
      faceSwapPreview: null,
      setFaceSwapPreview: vi.fn(),
    });
  });

  describe('error handling', () => {
    it('disables generate when prompt is empty in video tab', async () => {
      const user = userEvent.setup();
      const onRender = vi.fn();

      renderPanel({
        prompt: '   ',
        onRender,
        tier: 'render',
      });

      const generateButton = screen.getByRole('button', { name: 'Generate' });
      expect(generateButton).toBeDisabled();

      await user.click(generateButton);
      expect(onRender).not.toHaveBeenCalled();
    });

    it('disables generate when image tab has no keyframes', () => {
      renderPanel({
        prompt: 'Has prompt',
        keyframes: [],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Image' }));

      const generateButton = screen.getByRole('button', { name: 'Generate' });
      expect(generateButton).toBeDisabled();
    });

    it('disables uploads when keyframe limit is reached', () => {
      const keyframes = [createKeyframe({ id: '1' }), createKeyframe({ id: '2' }), createKeyframe({ id: '3' })];

      const { container } = renderPanel({
        keyframes,
      });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
      expect(fileInput?.disabled).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('uses capability allowed values for aspect ratio and duration', () => {
      const schema: CapabilitiesSchema = {
        provider: 'mock',
        model: 'mock',
        version: '1',
        fields: {
          aspect_ratio: {
            type: 'enum',
            values: ['2:1', '1:2'],
          },
          duration_s: {
            type: 'enum',
            values: [2, 4],
          },
        },
      };

      useCapabilitiesMock.mockReturnValueOnce({
        schema,
        isLoading: false,
        error: null,
        target: { provider: 'mock', model: 'mock', label: 'Mock' },
      });

      renderPanel({
        aspectRatio: '2:1',
        duration: 2,
      });

      const ratioSelect = screen.getByLabelText('Aspect ratio');
      const durationSelect = screen.getByLabelText('Duration');
      expect(ratioSelect.querySelectorAll('option')).toHaveLength(2);
      expect(durationSelect.querySelectorAll('option')).toHaveLength(2);
      expect(screen.getByRole('option', { name: '2:1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '4s' })).toBeInTheDocument();
    });

    it('falls back to the default render model when selectedModel is invalid', async () => {
      const user = userEvent.setup();
      const onRender = vi.fn();

      renderPanel({
        selectedModel: 'unknown-model',
        prompt: 'Ready',
        onRender,
        tier: 'render',
      });

      await user.click(screen.getByRole('button', { name: 'Generate' }));

      expect(onRender).toHaveBeenCalledWith(VIDEO_RENDER_MODELS[0]?.id ?? 'sora-2', undefined);
    });
  });

  describe('core behavior', () => {
    it('invokes draft generation when tier is draft', async () => {
      const user = userEvent.setup();
      const onDraft = vi.fn();

      renderPanel({
        tier: 'draft',
        selectedModel: VIDEO_DRAFT_MODEL.id,
        prompt: 'Ready',
        onDraft,
      });

      await user.click(screen.getByRole('button', { name: 'Generate' }));

      expect(onDraft).toHaveBeenCalledWith(VIDEO_DRAFT_MODEL.id, undefined);
    });
  });
});
