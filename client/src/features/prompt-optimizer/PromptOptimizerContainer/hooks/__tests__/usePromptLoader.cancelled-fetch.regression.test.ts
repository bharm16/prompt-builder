import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptLoader } from '../usePromptLoader';

const mockGetById = vi.hoisted(() => vi.fn());

vi.mock('@repositories/index', () => ({
  getPromptRepositoryForUser: vi.fn(() => ({
    getById: mockGetById,
  })),
}));

type LoaderParams = Parameters<typeof usePromptLoader>[0];

const buildParams = (overrides: Partial<LoaderParams> = {}): LoaderParams => {
  const baseToast = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  };

  return {
    sessionId: 'session_abc123',
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
    setSelectedMode: vi.fn(),
    setSelectedModel: vi.fn(),
    setGenerationParams: vi.fn(),
    setPromptContext: vi.fn(),
    onLoadKeyframes: vi.fn(),
    skipLoadFromUrlRef: { current: false },
    isAuthResolved: true,
    ...overrides,
  };
};

describe('regression: prompt hydration completes even when effect dependencies change mid-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries the load when the initial fetch is cancelled by a dependency change', async () => {
    // Simulate a slow fetch that will be in-flight when a dependency change triggers a re-render.
    let resolveFirstFetch!: (value: unknown) => void;
    const firstFetchPromise = new Promise((resolve) => {
      resolveFirstFetch = resolve;
    });

    mockGetById
      .mockReturnValueOnce(firstFetchPromise)
      .mockResolvedValue({
        id: 'session_abc123',
        uuid: 'uuid-abc',
        input: 'test input',
        output: 'test output',
        keyframes: [],
      });

    const params = buildParams();
    // Use a fresh function reference for upsertHistoryEntry so we can change it
    const upsertV1 = vi.fn();
    const paramsV1 = { ...params, upsertHistoryEntry: upsertV1 };

    const { rerender } = renderHook(
      ({ hookParams }: { hookParams: LoaderParams }) =>
        usePromptLoader(hookParams),
      { initialProps: { hookParams: paramsV1 } }
    );

    // The first effect should have started the fetch
    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledTimes(1);
    });

    // Simulate a dependency change (e.g. history loaded, causing upsertHistoryEntry to recreate).
    // This will cancel the in-flight effect and re-run usePromptLoader.
    const upsertV2 = vi.fn();
    const paramsV2 = { ...params, upsertHistoryEntry: upsertV2 };
    rerender({ hookParams: paramsV2 });

    // Now resolve the first fetch — but it was cancelled, so its data won't be applied
    resolveFirstFetch({
      id: 'session_abc123',
      uuid: 'uuid-abc',
      input: 'test input',
      output: 'test output',
      keyframes: [],
    });

    // Allow async work to settle
    await waitFor(() => {
      // The second effect run must also fire a fetch (not be blocked by the dedup guard)
      expect(mockGetById).toHaveBeenCalledTimes(2);
    });

    // The prompt state should have been hydrated from the second fetch
    await waitFor(() => {
      expect(params.setDisplayedPromptSilently).toHaveBeenCalledWith('test output');
    });
    expect(params.setShowResults).toHaveBeenCalledWith(true);
    expect(params.promptOptimizer.setInputPrompt).toHaveBeenCalledWith('test input');
  });
});
