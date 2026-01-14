import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSuggestionSelection } from '@features/prompt-optimizer/PromptCanvas/hooks/useSuggestionSelection';

describe('useSuggestionSelection', () => {
  it('marks hasInteracted when a span is selected', () => {
    const setState = vi.fn();

    renderHook(() =>
      useSuggestionSelection({
        selectedSpanId: 'span-1',
        hasInteracted: false,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({ hasInteracted: true });
  });

  it('does not update state when already interacted', () => {
    const setState = vi.fn();

    renderHook(() =>
      useSuggestionSelection({
        selectedSpanId: 'span-1',
        hasInteracted: true,
        setState,
      })
    );

    expect(setState).not.toHaveBeenCalled();
  });
});
