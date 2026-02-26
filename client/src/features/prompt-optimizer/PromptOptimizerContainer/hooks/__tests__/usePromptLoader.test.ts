import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptLoader } from '../usePromptLoader';

const mockGetById = vi.hoisted(() => vi.fn());

vi.mock('@repositories/index', () => ({
  getPromptRepositoryForUser: vi.fn(() => ({
    getById: mockGetById,
  })),
}));

type LoaderOverrides = Partial<Parameters<typeof usePromptLoader>[0]>;

const buildParams = (overrides: LoaderOverrides = {}) => {
  const baseToast = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };

  return {
    sessionId: null,
    currentPromptUuid: null,
    navigate: vi.fn(),
    toast: baseToast,
    user: { uid: 'user-1' },
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
    setSelectedModel: vi.fn(),
    setPromptContext: vi.fn(),
    onLoadKeyframes: vi.fn(),
    skipLoadFromUrlRef: { current: false },
    ...overrides,
  };
};

describe('usePromptLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch remote prompt data for local draft session ids', async () => {
    mockGetById.mockResolvedValue(null);
    const params = buildParams({ sessionId: 'draft-123' });

    const { result } = renderHook(() => usePromptLoader(params));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetById).not.toHaveBeenCalled();
    expect(params.navigate).not.toHaveBeenCalled();
    expect(params.toast.error).not.toHaveBeenCalled();
  });

  it('dedupes failed fetch attempts for the same session key across rerenders', async () => {
    mockGetById.mockRejectedValue(new Error('Session not found'));
    const params = buildParams({ sessionId: 'session-1' });
    let onLoadKeyframes = vi.fn();

    const { rerender } = renderHook(() =>
      usePromptLoader({
        ...params,
        onLoadKeyframes,
      })
    );

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(params.navigate).toHaveBeenCalledWith('/', { replace: true });
    });

    onLoadKeyframes = vi.fn();
    rerender();

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledTimes(1);
    });
    expect(params.navigate).toHaveBeenCalledTimes(1);
  });
});
