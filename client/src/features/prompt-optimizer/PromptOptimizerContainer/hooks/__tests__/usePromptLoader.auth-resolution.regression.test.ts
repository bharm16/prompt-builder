import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptLoader } from '../usePromptLoader';

const mockGetById = vi.hoisted(() => vi.fn());

vi.mock('@repositories/index', () => ({
  getPromptRepositoryForUser: vi.fn(() => ({
    getById: mockGetById,
  })),
}));

type LoaderParams = Parameters<typeof usePromptLoader>[0] & {
  isAuthResolved?: boolean;
};

const buildParams = (overrides: Partial<LoaderParams> = {}): LoaderParams => {
  const baseToast = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };

  return {
    sessionId: 'session_123',
    currentPromptUuid: null,
    navigate: vi.fn(),
    toast: baseToast,
    user: null,
    promptOptimizer: {
      displayedPrompt: '',
      setInputPrompt: vi.fn(),
      setOptimizedPrompt: vi.fn(),
      setDisplayedPrompt: vi.fn(),
      setGenericOptimizedPrompt: vi.fn(),
      setPreviewPrompt: vi.fn(),
      setPreviewAspectRatio: vi.fn(),
    },
    setDisplayedPromptSilently: vi.fn(),
    applyInitialHighlightSnapshot: vi.fn(),
    resetEditStacks: vi.fn(),
    resetVersionEdits: vi.fn(),
    setCurrentPromptDocId: vi.fn(),
    setCurrentPromptUuid: vi.fn(),
    setShowResults: vi.fn(),
    setSelectedMode: vi.fn(),
    setSelectedModel: vi.fn(),
    setGenerationParams: vi.fn(),
    setPromptContext: vi.fn(),
    onLoadKeyframes: vi.fn(),
    skipLoadFromUrlRef: { current: false },
    isAuthResolved: false,
    ...overrides,
  };
};

describe('regression: session route hydration waits for auth resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not load remote session data until auth state has resolved', async () => {
    mockGetById.mockResolvedValue({
      id: 'session_123',
      uuid: 'uuid-123',
      input: 'raw prompt',
      output: 'optimized prompt',
      keyframes: [],
    });

    let params = buildParams({
      user: null,
      isAuthResolved: false,
    });

    const { rerender } = renderHook(
      ({ hookParams }: { hookParams: LoaderParams }) =>
        usePromptLoader(hookParams as unknown as Parameters<typeof usePromptLoader>[0]),
      {
        initialProps: { hookParams: params },
      }
    );

    await new Promise((resolve) => {
      window.setTimeout(resolve, 30);
    });

    expect(mockGetById).not.toHaveBeenCalled();

    params = buildParams({
      user: null,
      isAuthResolved: true,
    });

    rerender({ hookParams: params });

    await new Promise((resolve) => {
      window.setTimeout(resolve, 30);
    });

    expect(mockGetById).not.toHaveBeenCalled();

    params = buildParams({
      user: { uid: 'user-1' },
      isAuthResolved: true,
    });

    rerender({ hookParams: params });

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledTimes(1);
    });
  });

  it('restores mode and generation params when hydrating a remote session', async () => {
    const params = buildParams({
      user: { uid: 'user-1' },
      isAuthResolved: true,
    });

    mockGetById.mockResolvedValue({
      id: 'session_123',
      uuid: 'uuid-123',
      input: 'raw prompt',
      output: 'optimized prompt',
      mode: 'video',
      generationParams: {
        start_frame_asset_id: 'asset-123',
        aspect_ratio: '16:9',
      },
      keyframes: [],
    });

    renderHook(() => usePromptLoader(params));

    await waitFor(() => {
      expect(params.setSelectedMode).toHaveBeenCalledWith('video');
    });

    expect(params.setGenerationParams).toHaveBeenCalledWith({
      start_frame_asset_id: 'asset-123',
      aspect_ratio: '16:9',
    });
  });
});
