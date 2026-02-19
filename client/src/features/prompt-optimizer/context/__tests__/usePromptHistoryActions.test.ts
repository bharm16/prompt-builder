import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PromptHistoryEntry } from '../types';
import { usePromptHistoryActions } from '../usePromptHistoryActions';

const buildOptions = () => {
  const navigate = vi.fn();
  const setDisplayedPrompt = vi.fn();
  const resetPrompt = vi.fn();
  const setInputPrompt = vi.fn();
  const setOptimizedPrompt = vi.fn();
  const setPreviewPrompt = vi.fn();
  const setPreviewAspectRatio = vi.fn();

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
        setDisplayedPrompt,
        resetPrompt,
        setInputPrompt,
        setOptimizedPrompt,
        setPreviewPrompt,
        setPreviewAspectRatio,
      } as any,
      promptHistory: {
        createDraft: vi.fn(() => ({ uuid: 'uuid-draft', id: 'draft-123' })),
      },
      selectedMode: 'video',
      selectedModel: 'model-a',
      generationParams: {},
      applyInitialHighlightSnapshot: vi.fn(),
      resetEditStacks: vi.fn(),
      resetVersionEdits: vi.fn(),
      setSuggestionsData: vi.fn(),
      setConceptElements: vi.fn(),
      setPromptContext: vi.fn(),
      setGenerationParams: vi.fn(),
      setSelectedMode: vi.fn(),
      setSelectedModel: vi.fn(),
      setShowResults: vi.fn(),
      setCurrentPromptUuid: vi.fn(),
      setCurrentPromptDocId: vi.fn(),
      persistedSignatureRef: { current: null as string | null },
      isApplyingHistoryRef: { current: false },
      skipLoadFromUrlRef: { current: false },
    },
    mocks: {
      navigate,
    },
  };
};

describe('usePromptHistoryActions draft routing', () => {
  it('navigates new local drafts to root instead of /session/draft-*', () => {
    const { options, mocks } = buildOptions();
    const { result } = renderHook(() => usePromptHistoryActions(options));

    act(() => {
      result.current.handleCreateNew();
    });

    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(mocks.navigate).not.toHaveBeenCalledWith('/session/draft-123', { replace: true });
  });

  it('loads draft history entries without routing to /session/draft-*', () => {
    const { options, mocks } = buildOptions();
    const { result } = renderHook(() => usePromptHistoryActions(options));

    const draftEntry = {
      id: 'draft-999',
      uuid: 'uuid-draft',
      input: 'prompt',
      output: '',
      mode: 'video',
      generationParams: {},
      keyframes: [],
      highlightCache: null,
      brainstormContext: null,
    } as unknown as PromptHistoryEntry;

    act(() => {
      result.current.loadFromHistory(draftEntry);
    });

    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(mocks.navigate).not.toHaveBeenCalledWith('/session/draft-999', { replace: true });
  });
});
