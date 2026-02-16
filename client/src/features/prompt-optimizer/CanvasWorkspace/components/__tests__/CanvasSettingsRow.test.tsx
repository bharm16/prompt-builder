import React, { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasSettingsRow } from '../CanvasSettingsRow';
import {
  GenerationControlsProvider,
  useGenerationControlsContext,
  type GenerationControlsHandlers,
} from '@/features/prompt-optimizer/context/GenerationControlsContext';
import { GenerationControlsStoreProvider } from '@/features/prompt-optimizer/context/GenerationControlsStore';
import type { GenerationControlsState } from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import { DEFAULT_GENERATION_CONTROLS_STATE } from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import { VIDEO_DRAFT_MODEL } from '@/components/ToolSidebar/config/modelConfig';

vi.mock('../StartFramePopover', () => ({
  StartFramePopover: () => <div data-testid="start-frame-popover" />,
}));

vi.mock(
  '@/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping',
  () => ({
    useCapabilitiesClamping: () => ({
      aspectRatioInfo: null,
      durationInfo: null,
      aspectRatioOptions: ['16:9', '9:16'],
      durationOptions: [5, 10],
    }),
  })
);

vi.mock('@/features/model-intelligence/api', () => ({
  trackModelRecommendationEvent: vi.fn(),
}));

function ControlsBridge({
  controls,
}: {
  controls: GenerationControlsHandlers | null;
}): React.ReactElement | null {
  const { setControls } = useGenerationControlsContext();

  useEffect(() => {
    setControls(controls);
    return () => setControls(null);
  }, [controls, setControls]);

  return null;
}

const buildState = (overrides: Partial<GenerationControlsState['domain']> = {}): GenerationControlsState => ({
  ...DEFAULT_GENERATION_CONTROLS_STATE,
  domain: {
    ...DEFAULT_GENERATION_CONTROLS_STATE.domain,
    selectedModel: 'sora-2',
    generationParams: {
      aspect_ratio: '16:9',
      duration_s: 5,
    },
    ...overrides,
  },
});

function renderRow(options: {
  controls: GenerationControlsHandlers | null;
  state?: GenerationControlsState | undefined;
  prompt?: string | undefined;
}): void {
  const { controls, state = buildState(), prompt = 'A city at night' } = options;

  render(
    <GenerationControlsStoreProvider initialState={state}>
      <GenerationControlsProvider>
        <ControlsBridge controls={controls} />
        <CanvasSettingsRow
          prompt={prompt}
          renderModelId="sora-2"
          onOpenMotion={vi.fn()}
        />
      </GenerationControlsProvider>
    </GenerationControlsStoreProvider>
  );
}

describe('CanvasSettingsRow', () => {
  it('uses GenerationControlsContext controls for preview and render actions', () => {
    const onStoryboard = vi.fn();
    const onDraft = vi.fn();
    const onRender = vi.fn();

    renderRow({
      controls: {
        onStoryboard,
        onDraft,
        onRender,
        isGenerating: false,
        activeDraftModel: null,
      },
    });

    fireEvent.click(screen.getByTestId('canvas-preview-button'));
    fireEvent.click(screen.getByTestId('canvas-generate-button'));

    expect(onStoryboard).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenCalledWith('sora-2');
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('uses draft action when Wan draft model is selected', () => {
    const onDraft = vi.fn();
    const onRender = vi.fn();

    renderRow({
      controls: {
        onStoryboard: vi.fn(),
        onDraft,
        onRender,
        isGenerating: false,
        activeDraftModel: null,
      },
      state: buildState({ selectedModel: VIDEO_DRAFT_MODEL.id }),
    });

    fireEvent.click(screen.getByTestId('canvas-generate-button'));

    expect(onDraft).toHaveBeenCalledWith(VIDEO_DRAFT_MODEL.id);
    expect(onRender).not.toHaveBeenCalled();
  });

  it('disables preview/generate buttons when controls are unavailable', () => {
    renderRow({ controls: null });

    expect(screen.getByTestId('canvas-preview-button')).toBeDisabled();
    expect(screen.getByTestId('canvas-generate-button')).toBeDisabled();
  });

  it('disables preview/generate buttons while generation is in progress', () => {
    renderRow({
      controls: {
        onStoryboard: vi.fn(),
        onDraft: vi.fn(),
        onRender: vi.fn(),
        isGenerating: true,
        activeDraftModel: VIDEO_DRAFT_MODEL.id,
      },
    });

    expect(screen.getByTestId('canvas-preview-button')).toBeDisabled();
    expect(screen.getByTestId('canvas-generate-button')).toBeDisabled();
  });
});
