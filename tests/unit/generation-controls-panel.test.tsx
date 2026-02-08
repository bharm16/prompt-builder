import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CapabilitiesSchema } from '@shared/capabilities';

import { GenerationControlsPanel } from '@components/ToolSidebar/components/panels/GenerationControlsPanel';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import type { KeyframeTile } from '@components/ToolSidebar/types';

vi.mock(
  '@utils/cn',
  () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' '),
  })
);

const useCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@features/prompt-optimizer/hooks/useCapabilities', () => ({
  useCapabilities: (...args: unknown[]) => useCapabilitiesMock(...args),
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

describe('GenerationControlsPanel', () => {
  beforeEach(() => {
    useCapabilitiesMock.mockReturnValue({
      schema: null,
      isLoading: false,
      error: null,
      target: { provider: 'mock', model: 'mock', label: 'Mock' },
    });
  });

  describe('error handling', () => {
    it('disables generate when prompt is empty in video tab', async () => {
      const user = userEvent.setup();
      const onRender = vi.fn();

      render(
        <GenerationControlsPanel
          {...createProps({
            prompt: '   ',
            onRender,
            tier: 'render',
          })}
        />
      );

      const generateButton = screen.getByRole('button', { name: 'Generate' });
      expect(generateButton).toBeDisabled();

      await user.click(generateButton);
      expect(onRender).not.toHaveBeenCalled();
    });

    it('disables generate when image tab has no keyframes', async () => {
      const user = userEvent.setup();

      render(
        <GenerationControlsPanel
          {...createProps({
            prompt: 'Has prompt',
            keyframes: [],
          })}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Image' }));

      const generateButton = screen.getByRole('button', { name: 'Generate' });
      expect(generateButton).toBeDisabled();
    });

    it('disables uploads when keyframe limit is reached', () => {
      const keyframes = [createKeyframe({ id: '1' }), createKeyframe({ id: '2' }), createKeyframe({ id: '3' })];

      const { container } = render(
        <GenerationControlsPanel
          {...createProps({
            keyframes,
          })}
        />
      );

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

      render(
        <GenerationControlsPanel
          {...createProps({
            aspectRatio: '2:1',
            duration: 2,
          })}
        />
      );

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

      render(
        <GenerationControlsPanel
          {...createProps({
            selectedModel: 'unknown-model',
            prompt: 'Ready',
            onRender,
            tier: 'render',
          })}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Generate' }));

      expect(onRender).toHaveBeenCalledWith(VIDEO_RENDER_MODELS[0]?.id ?? 'sora-2');
    });
  });

  describe('core behavior', () => {
    it('invokes draft generation when tier is draft', async () => {
      const user = userEvent.setup();
      const onDraft = vi.fn();

      render(
        <GenerationControlsPanel
          {...createProps({
            tier: 'draft',
            prompt: 'Ready',
            onDraft,
          })}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Generate' }));

      expect(onDraft).toHaveBeenCalledWith(VIDEO_DRAFT_MODEL.id);
    });
  });
});
