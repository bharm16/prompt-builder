import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSuggestionFeedback } from '@features/prompt-optimizer/PromptCanvas/hooks/useSuggestionFeedback';
import type { SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';

describe('useSuggestionFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets feedback state and clears it after timeout', () => {
    const setState = vi.fn();
    const onSuggestionClick = vi.fn();
    const suggestionsData: SuggestionsData = {
      show: true,
      selectedText: 'old text',
      originalText: 'old text',
      suggestions: [],
      isLoading: false,
      isPlaceholder: false,
      fullPrompt: 'Prompt',
    };

    const { result } = renderHook(() =>
      useSuggestionFeedback({
        suggestionsData,
        selectedSpanId: 'span-1',
        onSuggestionClick,
        setState,
      })
    );

    act(() => {
      result.current.handleSuggestionClickWithFeedback({ text: 'new text' });
    });

    expect(setState).toHaveBeenCalledWith({
      justReplaced: { from: 'old text', to: 'new text' },
    });
    expect(setState).toHaveBeenCalledWith({ lastAppliedSpanId: 'span-1' });
    expect(onSuggestionClick).toHaveBeenCalledWith({ text: 'new text' });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(setState).toHaveBeenCalledWith({ justReplaced: null });
  });

  it('tracks last applied span even without replacement', () => {
    const setState = vi.fn();

    const { result } = renderHook(() =>
      useSuggestionFeedback({
        suggestionsData: null,
        selectedSpanId: 'span-2',
        setState,
      })
    );

    act(() => {
      result.current.handleSuggestionClickWithFeedback('');
    });

    expect(setState).toHaveBeenCalledWith({ lastAppliedSpanId: 'span-2' });
  });
});
