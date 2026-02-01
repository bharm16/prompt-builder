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
import { storageApi } from '@/api/storageApi';

vi.mock('@/api/storageApi', () => ({
  storageApi: {
    getViewUrl: vi.fn(),
  },
}));

const buildInitialState = (overrides: Partial<GenerationControlsState> = {}): GenerationControlsState => ({
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
    (storageApi.getViewUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
      viewUrl: 'https://storage.example.com/updated.png',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
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
      expect(storageApi.getViewUrl).toHaveBeenCalledWith('uploads/frame1.png');
    });

    await waitFor(() => {
      expect(result.current.domain.keyframes[0]?.url).toBe('https://storage.example.com/updated.png');
    });

  });

  it('handles refresh failures gracefully', async () => {
    (storageApi.getViewUrl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'));

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
      expect(storageApi.getViewUrl).toHaveBeenCalled();
    });

    expect(result.current.domain.keyframes[0]?.url).toBe('https://storage.example.com/original.png');
  });
});
