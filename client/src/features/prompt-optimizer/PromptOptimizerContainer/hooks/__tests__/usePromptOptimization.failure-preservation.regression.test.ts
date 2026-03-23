import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePromptOptimization } from '../usePromptOptimization';

const buildParams = () => {
  const optimize = vi.fn(async () => null);
  const compile = vi.fn(async () => ({ optimized: 'Compiled prompt', score: 90 }));
  const setInputPrompt = vi.fn();
  const setCurrentPromptUuid = vi.fn();
  const setCurrentPromptDocId = vi.fn();
  const setDisplayedPromptSilently = vi.fn();
  const setShowResults = vi.fn();
  const applyInitialHighlightSnapshot = vi.fn();
  const resetEditStacks = vi.fn();
  const navigate = vi.fn();
  const saveToHistory = vi.fn(async () => ({ uuid: 'uuid-1', id: 'session-1' }));
  const updateEntryVersions = vi.fn();

  return {
    params: {
      promptOptimizer: {
        inputPrompt: 'Original shot prompt',
        genericOptimizedPrompt: null,
        improvementContext: null,
        qualityScore: null,
        optimize,
        compile,
        setInputPrompt,
      },
      promptHistory: {
        history: [],
        updateEntryVersions,
        saveToHistory,
      },
      promptContext: null,
      selectedMode: 'video',
      selectedModel: 'sora',
      generationParams: {},
      keyframes: null,
      currentPromptUuid: 'uuid-current',
      setCurrentPromptUuid,
      setCurrentPromptDocId,
      setDisplayedPromptSilently,
      setShowResults,
      applyInitialHighlightSnapshot,
      resetEditStacks,
      persistedSignatureRef: { current: null as string | null },
      skipLoadFromUrlRef: { current: false },
      navigate,
    },
    mocks: {
      optimize,
      saveToHistory,
      setDisplayedPromptSilently,
      setShowResults,
      navigate,
    },
  };
};

describe('regression: failed optimization orchestration does not blank the canvas', () => {
  it('does not clear the displayed prompt before an optimize request that returns no result', async () => {
    const { params, mocks } = buildParams();
    const { result } = renderHook(() => usePromptOptimization(params));

    await act(async () => {
      await result.current.handleOptimize('Original shot prompt');
    });

    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    expect(mocks.setDisplayedPromptSilently).not.toHaveBeenCalledWith('');
    expect(mocks.setShowResults).not.toHaveBeenCalledWith(true);
    expect(mocks.saveToHistory).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
