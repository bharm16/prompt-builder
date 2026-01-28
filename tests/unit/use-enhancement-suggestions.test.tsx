import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useEnhancementSuggestions } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useEnhancementSuggestions';
import { useSuggestionApply } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionApply';
import { useSuggestionFetch } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionFetch';
import type { SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';
import type { PromptOptimizer } from '@features/prompt-optimizer/context/types';
import type { Toast } from '@hooks/types';

vi.mock('@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionApply', () => ({
  useSuggestionApply: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionFetch', () => ({
  useSuggestionFetch: vi.fn(),
}));

const mockUseSuggestionApply = vi.mocked(useSuggestionApply);
const mockUseSuggestionFetch = vi.mocked(useSuggestionFetch);

const createToast = (): Toast => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

const createPromptOptimizer = (): PromptOptimizer => {
  const setInputPrompt: MockedFunction<PromptOptimizer['setInputPrompt']> = vi.fn();
  const setOptimizedPrompt: MockedFunction<PromptOptimizer['setOptimizedPrompt']> = vi.fn();
  const setDisplayedPrompt: MockedFunction<PromptOptimizer['setDisplayedPrompt']> = vi.fn();
  const setGenericOptimizedPrompt: MockedFunction<
    NonNullable<PromptOptimizer['setGenericOptimizedPrompt']>
  > = vi.fn();
  const setPreviewPrompt: MockedFunction<PromptOptimizer['setPreviewPrompt']> = vi.fn();
  const setPreviewAspectRatio: MockedFunction<PromptOptimizer['setPreviewAspectRatio']> = vi.fn();
  const setSkipAnimation: MockedFunction<PromptOptimizer['setSkipAnimation']> = vi.fn();
  const setImprovementContext: MockedFunction<PromptOptimizer['setImprovementContext']> = vi.fn();
  const optimize: MockedFunction<PromptOptimizer['optimize']> = vi.fn();
  const compile: MockedFunction<PromptOptimizer['compile']> = vi.fn();
  const resetPrompt: MockedFunction<PromptOptimizer['resetPrompt']> = vi.fn();
  const setLockedSpans: MockedFunction<PromptOptimizer['setLockedSpans']> = vi.fn();
  const addLockedSpan: MockedFunction<PromptOptimizer['addLockedSpan']> = vi.fn();
  const removeLockedSpan: MockedFunction<PromptOptimizer['removeLockedSpan']> = vi.fn();
  const clearLockedSpans: MockedFunction<PromptOptimizer['clearLockedSpans']> = vi.fn();

  return {
    inputPrompt: '',
    setInputPrompt,
    isProcessing: false,
    optimizedPrompt: '',
    setOptimizedPrompt,
    displayedPrompt: '',
    setDisplayedPrompt,
    genericOptimizedPrompt: null,
    setGenericOptimizedPrompt,
    previewPrompt: null,
    setPreviewPrompt,
    previewAspectRatio: null,
    setPreviewAspectRatio,
    qualityScore: null,
    skipAnimation: false,
    setSkipAnimation,
    improvementContext: null,
    setImprovementContext,
    draftPrompt: '',
    isDraftReady: false,
    isRefining: false,
    draftSpans: null,
    refinedSpans: null,
    lockedSpans: [],
    optimize,
    compile,
    resetPrompt,
    setLockedSpans,
    addLockedSpan,
    removeLockedSpan,
    clearLockedSpans,
  };
};

describe('useEnhancementSuggestions', () => {
  it('wires apply and fetch handlers together', () => {
    const handleSuggestionClick = vi.fn();
    const fetchEnhancementSuggestions = vi.fn();

    mockUseSuggestionApply.mockReturnValue({ handleSuggestionClick });
    mockUseSuggestionFetch.mockReturnValue({ fetchEnhancementSuggestions });

    const suggestionsData: SuggestionsData = {
      show: false,
      selectedText: '',
      originalText: '',
      suggestions: [],
      isLoading: false,
      isPlaceholder: false,
      fullPrompt: '',
    };

    const promptOptimizer = createPromptOptimizer();

    const setSuggestionsData = vi.fn();

    const { result } = renderHook(() =>
      useEnhancementSuggestions({
        promptOptimizer,
        selectedMode: 'video',
        suggestionsData,
        setSuggestionsData,
        handleDisplayedPromptChange: vi.fn(),
        stablePromptContext: null,
        toast: createToast(),
        applyInitialHighlightSnapshot: vi.fn(),
        latestHighlightRef: { current: null },
        currentPromptUuid: 'uuid-1',
        currentPromptDocId: 'doc-1',
        promptHistory: { updateEntryOutput: vi.fn() },
      })
    );

    expect(mockUseSuggestionApply).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestionsData,
        setSuggestionsData,
      })
    );

    expect(mockUseSuggestionFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        promptOptimizer,
        selectedMode: 'video',
        suggestionsData,
        setSuggestionsData,
        handleSuggestionClick,
      })
    );

    expect(result.current.handleSuggestionClick).toBe(handleSuggestionClick);
    expect(result.current.fetchEnhancementSuggestions).toBe(fetchEnhancementSuggestions);
  });
});
