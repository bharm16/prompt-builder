import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PromptHistoryEntry } from '@features/prompt-optimizer/types/domain/prompt-session';
import { usePromptHistoryActions } from '@features/prompt-optimizer/context/usePromptHistoryActions';

const buildOptions = (
  overrides: Partial<Parameters<typeof usePromptHistoryActions>[0]> = {}
) => {
  const navigate = vi.fn();
  const createDraft = vi.fn(() => ({ uuid: 'uuid-draft', id: 'draft-123' }));

  return {
    options: {
      debug: {
        logAction: vi.fn(),
        logError: vi.fn(),
        startTimer: vi.fn(),
        endTimer: vi.fn(),
      } as any,
      navigate,
      promptOptimizer: {
        setDisplayedPrompt: vi.fn(),
        inputPrompt: '',
        optimizedPrompt: '',
        displayedPrompt: '',
      } as any,
      promptHistory: {
        createDraft,
      },
      selectedMode: 'video',
      selectedModel: 'model-a',
      generationParams: {},
      currentPromptUuid: null,
      currentPromptDocId: null,
      promptContext: null,
      currentKeyframes: [],
      currentHighlightSnapshot: null,
      currentVersions: [],
      isApplyingHistoryRef: { current: false },
      ...overrides,
    },
    mocks: {
      navigate,
      createDraft,
    },
  };
};

describe('usePromptHistoryActions', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sets displayed prompt silently while toggling the applying-history flag', () => {
    vi.useFakeTimers();
    const { options } = buildOptions();
    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.setDisplayedPromptSilently('Hidden prompt');
    });

    expect(options.isApplyingHistoryRef.current).toBe(true);
    expect(options.promptOptimizer.setDisplayedPrompt).toHaveBeenCalledWith('Hidden prompt');

    act(() => {
      vi.runAllTimers();
    });

    expect(options.isApplyingHistoryRef.current).toBe(false);
  });

  it('persists meaningful local state before creating a new draft route', () => {
    vi.useFakeTimers();
    const { options, mocks } = buildOptions({
      promptOptimizer: {
        setDisplayedPrompt: vi.fn(),
        inputPrompt: 'A cinematic alley at dawn',
        optimizedPrompt: '',
        displayedPrompt: '',
      } as any,
    });
    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.handleCreateNew();
    });

    expect(mocks.createDraft).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: 'A cinematic alley at dawn',
        output: '',
        persist: true,
      })
    );
    expect(mocks.createDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: 'video',
        targetModel: 'model-a',
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/session/draft-123', { replace: true });
  });

  it('routes history loads through /session/:sessionId', () => {
    const { options, mocks } = buildOptions();
    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.loadFromHistory({
        id: 'session-123',
        uuid: 'uuid-target',
        input: 'remote input',
        output: 'remote output',
        mode: 'video',
      } as PromptHistoryEntry);
    });

    expect(mocks.navigate).toHaveBeenCalledWith('/session/session-123', { replace: true });
  });
});
