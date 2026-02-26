import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { GenerationControlsState } from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import {
  DEFAULT_GENERATION_CONTROLS_STATE,
} from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import {
  GenerationControlsStoreProvider,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useI2VContext } from '../useI2VContext';
import { observeImage } from '../../api/i2vApi';

vi.mock('../../api/i2vApi', () => ({
  observeImage: vi.fn(),
}));

vi.mock('@/services/media/MediaUrlResolver', () => ({
  resolveMediaUrl: vi.fn(async ({ url }: { url: string | null }) => ({ url })),
}));

type GenerationControlsStateOverrides = Partial<Omit<GenerationControlsState, 'domain' | 'ui'>> & {
  domain?: Partial<GenerationControlsState['domain']>;
  ui?: Partial<GenerationControlsState['ui']>;
};

const buildInitialState = (overrides: GenerationControlsStateOverrides = {}): GenerationControlsState => ({
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

const buildWrapper = (initialState: GenerationControlsState) =>
  ({ children }: { children: ReactNode }) => (
    <GenerationControlsStoreProvider initialState={initialState}>
      {children}
    </GenerationControlsStoreProvider>
  );

describe('useI2VContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (observeImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      observation: {
        summary: 'ok',
      },
    });
  });

  it('does not enter i2v mode when only keyframes[0] exists', () => {
    const initialState = buildInitialState({
      domain: {
        startFrame: null,
        keyframes: [
          {
            id: 'legacy-keyframe',
            url: 'https://example.com/legacy.png',
            source: 'upload',
          },
        ],
      },
    });

    const { result } = renderHook(() => useI2VContext(), {
      wrapper: buildWrapper(initialState),
    });

    expect(result.current.isI2VMode).toBe(false);
    expect(result.current.startImageUrl).toBeNull();
  });

  it('reads start image from startFrame', async () => {
    const initialState = buildInitialState({
      domain: {
        startFrame: {
          id: 'start-frame',
          url: 'https://example.com/start.png',
          source: 'upload',
          sourcePrompt: 'a start frame',
        },
        keyframes: [],
      },
    });

    const { result } = renderHook(() => useI2VContext(), {
      wrapper: buildWrapper(initialState),
    });

    expect(result.current.isI2VMode).toBe(true);
    expect(result.current.startImageUrl).toBe('https://example.com/start.png');

    await waitFor(() => {
      expect(observeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          image: 'https://example.com/start.png',
          sourcePrompt: 'a start frame',
        }),
        expect.any(Object)
      );
    });
  });
});
