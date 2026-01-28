import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSuggestionDetection } from '@features/prompt-optimizer/PromptCanvas/hooks/useSuggestionDetection';

describe('useSuggestionDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers refresh when suggestions close after prompt change', () => {
    const refreshLabeling = vi.fn();

    const { rerender } = renderHook(useSuggestionDetection, {
      initialProps: {
        displayedPrompt: 'A',
        isSuggestionsOpen: false,
        refreshLabeling,
      },
    });

    rerender({ displayedPrompt: 'A', isSuggestionsOpen: true, refreshLabeling });
    rerender({ displayedPrompt: 'B', isSuggestionsOpen: false, refreshLabeling });

    vi.runAllTimers();

    expect(refreshLabeling).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when prompt does not change', () => {
    const refreshLabeling = vi.fn();

    const { rerender } = renderHook(useSuggestionDetection, {
      initialProps: {
        displayedPrompt: 'A',
        isSuggestionsOpen: false,
        refreshLabeling,
      },
    });

    rerender({ displayedPrompt: 'A', isSuggestionsOpen: true, refreshLabeling });
    rerender({ displayedPrompt: 'A', isSuggestionsOpen: false, refreshLabeling });

    vi.runAllTimers();

    expect(refreshLabeling).not.toHaveBeenCalled();
  });
});
