import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { CapabilitiesSchema } from '@shared/capabilities';
import type { GenerationControlsPanelProps } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/types';
import { useGenerationControlsPanel } from '../useGenerationControlsPanel';
import {
  GenerationControlsStoreProvider,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { GenerationControlsProvider } from '@/features/prompt-optimizer/context/GenerationControlsContext';
import {
  DEFAULT_GENERATION_CONTROLS_STATE,
  type GenerationControlsState,
} from '@/features/prompt-optimizer/context/generationControlsStoreTypes';

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

vi.mock('@/features/prompt-optimizer/context/PromptStateContext', () => ({
  useOptionalPromptHighlights: () => null,
  usePromptServices: () => ({
    promptOptimizer: {
      inputPrompt: 'Test prompt',
      setInputPrompt: vi.fn(),
    },
  }),
}));

vi.mock('@/features/span-highlighting', () => ({
  sanitizeText: (value: string) => value,
}));

vi.mock('@/features/prompt-optimizer/context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => ({
    session: null,
    loading: false,
    error: null,
    isSequenceMode: false,
    hasActiveContinuityShot: false,
    shots: [],
    editorShots: [],
    currentShotId: null,
    currentShot: null,
    currentEditorShot: null,
    currentShotIndex: -1,
    setCurrentShotId: vi.fn(),
    refreshSession: vi.fn(),
    addShot: vi.fn(),
    updateShot: vi.fn(),
    updateShotStyleReference: vi.fn(),
    generateShot: vi.fn(),
    startSequence: vi.fn(),
    isStartingSequence: false,
  }),
}));

const buildBaseProps = (
  overrides: Partial<GenerationControlsPanelProps> = {}
): GenerationControlsPanelProps => ({
  onDraft: vi.fn(),
  onRender: vi.fn(),
  onStoryboard: vi.fn(),
  ...overrides,
});

type GenerationControlsStateOverrides = Partial<Omit<GenerationControlsState, 'domain' | 'ui'>> & {
  domain?: Partial<GenerationControlsState['domain']>;
  ui?: Partial<GenerationControlsState['ui']>;
};

const buildInitialState = (
  overrides: GenerationControlsStateOverrides = {}
): GenerationControlsState => ({
  ...DEFAULT_GENERATION_CONTROLS_STATE,
  ...overrides,
  domain: {
    ...DEFAULT_GENERATION_CONTROLS_STATE.domain,
    ...(overrides.domain ?? {}),
  },
  ui: {
    ...DEFAULT_GENERATION_CONTROLS_STATE.ui,
    ...(overrides.ui ?? {}),
  },
});

const buildWrapper = (initialState?: GenerationControlsState) =>
  ({ children }: { children: ReactNode }) => (
    <GenerationControlsStoreProvider {...(initialState ? { initialState } : {})}>
      <GenerationControlsProvider>{children}</GenerationControlsProvider>
    </GenerationControlsStoreProvider>
  );

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
    const props = buildBaseProps();
    const initialState = buildInitialState({
      domain: {
        generationParams: {
          aspect_ratio: '4:5',
          duration_s: 7,
        },
      },
    });

    const { result } = renderHook(() => useGenerationControlsPanel(props), {
      wrapper: buildWrapper(initialState),
    });

    await waitFor(() => {
      expect(result.current.store.aspectRatio).toBe('16:9');
    });

    await waitFor(() => {
      expect(result.current.store.duration).toBe(5);
    });
  });

  it('does not clamp when values are already supported', async () => {
    const props = buildBaseProps();
    const initialState = buildInitialState({
      domain: {
        generationParams: {
          aspect_ratio: '16:9',
          duration_s: 10,
        },
      },
    });

    const { result } = renderHook(() => useGenerationControlsPanel(props), {
      wrapper: buildWrapper(initialState),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.store.aspectRatio).toBe('16:9');
    expect(result.current.store.duration).toBe(10);
  });
});
