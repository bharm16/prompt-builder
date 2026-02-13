import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { GenerationControlsState } from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import {
  DEFAULT_GENERATION_CONTROLS_STATE,
} from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import {
  GenerationControlsStoreProvider,
  useGenerationControlsStoreState,
} from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useKeyframeUrlRefresh } from '../useKeyframeUrlRefresh';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';

vi.mock('@/services/media/MediaUrlResolver', () => ({
  resolveMediaUrl: vi.fn(),
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

describe('useKeyframeUrlRefresh', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes stale keyframes and updates store', async () => {
    (resolveMediaUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://storage.example.com/updated.png',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      storagePath: 'uploads/frame1.png',
      source: 'storage',
    });

    const initialState = buildInitialState({
      domain: {
        keyframes: [
          {
            id: 'kf-1',
            url: 'https://storage.example.com/original.png',
            source: 'upload',
            storagePath: 'uploads/frame1.png',
            viewUrlExpiresAt: new Date(Date.now() - 60_000).toISOString(),
          },
        ],
      },
    });

    const { result } = renderHook(() => {
      useKeyframeUrlRefresh();
      return useGenerationControlsStoreState();
    }, { wrapper: buildWrapper(initialState) });

    await waitFor(() => {
      expect(resolveMediaUrl).toHaveBeenCalledWith({
        kind: 'image',
        url: 'https://storage.example.com/original.png',
        storagePath: 'uploads/frame1.png',
        preferFresh: true,
      });
    });

    await waitFor(() => {
      expect(result.current.domain.keyframes[0]?.url).toBe('https://storage.example.com/updated.png');
    });

  });

  it('handles refresh failures gracefully', async () => {
    (resolveMediaUrl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'));

    const initialState = buildInitialState({
      domain: {
        keyframes: [
          {
            id: 'kf-1',
            url: 'https://storage.example.com/original.png',
            source: 'upload',
            storagePath: 'uploads/frame1.png',
            viewUrlExpiresAt: new Date(Date.now() - 60_000).toISOString(),
          },
        ],
      },
    });

    const { result } = renderHook(() => {
      useKeyframeUrlRefresh();
      return useGenerationControlsStoreState();
    }, { wrapper: buildWrapper(initialState) });

    await waitFor(() => {
      expect(resolveMediaUrl).toHaveBeenCalled();
    });

    expect(result.current.domain.keyframes[0]?.url).toBe('https://storage.example.com/original.png');
  });

  it('refreshes stale start frame URL', async () => {
    (resolveMediaUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'https://storage.example.com/start-updated.png',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      storagePath: 'uploads/start-frame.png',
      source: 'storage',
    });

    const initialState = buildInitialState({
      domain: {
        keyframes: [],
        startFrame: {
          id: 'start-frame',
          url: 'https://storage.example.com/start-original.png',
          source: 'upload',
          storagePath: 'uploads/start-frame.png',
          viewUrlExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    });

    const { result } = renderHook(() => {
      useKeyframeUrlRefresh();
      return useGenerationControlsStoreState();
    }, { wrapper: buildWrapper(initialState) });

    await waitFor(() => {
      expect(resolveMediaUrl).toHaveBeenCalledWith({
        kind: 'image',
        url: 'https://storage.example.com/start-original.png',
        storagePath: 'uploads/start-frame.png',
        preferFresh: true,
      });
    });

    await waitFor(() => {
      expect(result.current.domain.startFrame?.url).toBe('https://storage.example.com/start-updated.png');
    });
  });
});
