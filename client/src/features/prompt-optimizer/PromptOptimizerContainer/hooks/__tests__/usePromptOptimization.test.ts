import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePromptOptimization } from '../usePromptOptimization';

const buildBaseParams = () => {
  const optimize = vi.fn(async () => ({ optimized: 'Optimized sequence prompt', score: 92 }));
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
      setInputPrompt,
      saveToHistory,
      setCurrentPromptUuid,
      setCurrentPromptDocId,
      setDisplayedPromptSilently,
      setShowResults,
      navigate,
    },
  };
};

describe('usePromptOptimization', () => {
  it('persists and navigates by default', async () => {
    const { params, mocks } = buildBaseParams();
    const { result } = renderHook(() => usePromptOptimization(params));

    await act(async () => {
      await result.current.handleOptimize('Original shot prompt');
    });

    expect(mocks.saveToHistory).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/session/session-1', { replace: true });
  });

  it('keeps sequence optimization in-place when preserveSessionView is enabled', async () => {
    const { params, mocks } = buildBaseParams();
    const { result } = renderHook(() => usePromptOptimization(params));

    await act(async () => {
      await result.current.handleOptimize('Original shot prompt', undefined, {
        preserveSessionView: true,
      });
    });

    expect(mocks.setInputPrompt).toHaveBeenCalledWith('Optimized sequence prompt');
    expect(mocks.setDisplayedPromptSilently).toHaveBeenCalledWith('');
    expect(mocks.setShowResults).toHaveBeenCalledWith(false);
    expect(mocks.saveToHistory).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.setCurrentPromptUuid).not.toHaveBeenCalled();
    expect(mocks.setCurrentPromptDocId).not.toHaveBeenCalled();
  });
});
