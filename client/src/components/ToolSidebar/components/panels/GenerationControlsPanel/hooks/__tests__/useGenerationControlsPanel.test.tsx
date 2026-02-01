import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { CapabilitiesSchema } from '@shared/capabilities';
import type { GenerationControlsPanelProps } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/types';
import { useGenerationControlsPanel } from '../useGenerationControlsPanel';

let mockSchema: CapabilitiesSchema | null = null;

vi.mock('@/features/prompt-optimizer/hooks/useCapabilities', () => ({
  useCapabilities: () => ({
    schema: mockSchema,
    isLoading: false,
    error: null,
    target: { provider: 'test', model: 'test', label: 'Test Model' },
  }),
}));

vi.mock('@/features/model-intelligence', () => ({
  useModelRecommendation: () => ({
    recommendation: null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/features/prompt-optimizer/components/TriggerAutocomplete', () => ({
  useTriggerAutocomplete: () => ({
    isOpen: false,
    suggestions: [],
    selectedIndex: -1,
    position: null,
    query: '',
    handleKeyDown: () => {},
    selectSuggestion: () => {},
    setSelectedIndex: () => {},
    close: () => {},
    updateFromCursor: () => {},
  }),
}));

vi.mock('@/features/prompt-optimizer/context/PromptStateContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/prompt-optimizer/context/PromptStateContext')>();
  return {
    ...actual,
    useOptionalPromptHighlights: () => null,
  };
});

vi.mock('@/features/span-highlighting', () => ({
  sanitizeText: (value: string) => value,
}));

const buildBaseProps = (
  overrides: Partial<GenerationControlsPanelProps> = {}
): GenerationControlsPanelProps => ({
  prompt: 'Test prompt',
  aspectRatio: '4:5',
  duration: 7,
  selectedModel: 'test-model',
  onModelChange: vi.fn(),
  onAspectRatioChange: vi.fn(),
  onDurationChange: vi.fn(),
  onDraft: vi.fn(),
  onRender: vi.fn(),
  isDraftDisabled: false,
  isRenderDisabled: false,
  keyframes: [],
  onAddKeyframe: vi.fn(),
  onRemoveKeyframe: vi.fn(),
  tier: 'render',
  onTierChange: vi.fn(),
  onStoryboard: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  mockSchema = {
    provider: 'test',
    model: 'test',
    version: '1',
    fields: {
      aspect_ratio: {
        type: 'enum',
        values: ['16:9', '9:16'],
      },
      duration_s: {
        type: 'enum',
        values: [5, 10, 15],
      },
    },
  };
});

describe('useGenerationControlsPanel', () => {
  it('clamps invalid aspect ratio and duration to supported values', async () => {
    const onAspectRatioChange = vi.fn();
    const onDurationChange = vi.fn();
    const props = buildBaseProps({ onAspectRatioChange, onDurationChange });

    renderHook(() => useGenerationControlsPanel(props));

    await waitFor(() => {
      expect(onAspectRatioChange).toHaveBeenCalledWith('16:9');
    });

    await waitFor(() => {
      expect(onDurationChange).toHaveBeenCalledWith(5);
    });
  });

  it('does not clamp when values are already supported', async () => {
    const onAspectRatioChange = vi.fn();
    const onDurationChange = vi.fn();
    const props = buildBaseProps({
      aspectRatio: '16:9',
      duration: 10,
      onAspectRatioChange,
      onDurationChange,
    });

    renderHook(() => useGenerationControlsPanel(props));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onAspectRatioChange).not.toHaveBeenCalled();
    expect(onDurationChange).not.toHaveBeenCalled();
  });
});
