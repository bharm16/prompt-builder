import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSuggestionApi } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionApi';
import { fetchEnhancementSuggestions } from '@features/prompt-optimizer/api/enhancementSuggestionsApi';
import { useEditHistory } from '@features/prompt-optimizer/hooks/useEditHistory';
import { prepareSpanContext } from '@features/span-highlighting/utils/spanProcessing';
import { CancellationError } from '@features/prompt-optimizer/utils/signalUtils';

vi.mock('@features/prompt-optimizer/api/enhancementSuggestionsApi', () => ({
  fetchEnhancementSuggestions: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/hooks/useEditHistory', () => ({
  useEditHistory: vi.fn(),
}));

vi.mock('@features/span-highlighting/utils/spanProcessing', () => ({
  prepareSpanContext: vi.fn(),
}));

const mockFetchEnhancementSuggestions = vi.mocked(fetchEnhancementSuggestions);
const mockUseEditHistory = vi.mocked(useEditHistory);
const mockPrepareSpanContext = vi.mocked(prepareSpanContext);

const suggestionContext = {
  startIndex: 5,
  matchLength: 3,
  contextBefore: 'before',
  contextAfter: 'after',
  found: true,
  usedFallback: false,
};

describe('useSuggestionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEditHistory.mockReturnValue({
      getEditSummary: vi.fn().mockReturnValue([{ id: 'edit-1' }]),
    } as ReturnType<typeof useEditHistory>);
    mockPrepareSpanContext.mockReturnValue({
      simplifiedSpans: [{ text: 'span-a' }],
      nearbySpans: [{ text: 'span-b' }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('propagates API errors from the request manager', async () => {
      vi.useFakeTimers();
      mockFetchEnhancementSuggestions.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() =>
        useSuggestionApi({
          promptOptimizer: { inputPrompt: 'input' },
          stablePromptContext: null,
        })
      );

      const promise = result.current.fetchSuggestions({
        dedupKey: 'dedup-key',
        normalizedHighlight: 'highlight',
        normalizedPrompt: 'prompt',
        suggestionContext,
        metadata: null,
        allLabeledSpans: [],
      });

      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toThrow('boom');
    });

    it('surfaces cancellation errors returned by the request', async () => {
      vi.useFakeTimers();
      mockFetchEnhancementSuggestions.mockRejectedValue(new CancellationError('cancelled'));

      const { result } = renderHook(() =>
        useSuggestionApi({
          promptOptimizer: { inputPrompt: 'input' },
          stablePromptContext: null,
        })
      );

      const promise = result.current.fetchSuggestions({
        dedupKey: 'dedup-cancel',
        normalizedHighlight: 'highlight',
        normalizedPrompt: 'prompt',
        suggestionContext,
        metadata: null,
        allLabeledSpans: [],
      });

      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toThrow(CancellationError);
    });
  });

  describe('edge cases', () => {
    it('invokes onRequestStart before dispatching the API call', async () => {
      vi.useFakeTimers();
      const callOrder: string[] = [];

      mockFetchEnhancementSuggestions.mockImplementation(async () => {
        callOrder.push('fetch');
        return { suggestions: [], isPlaceholder: false };
      });

      const { result } = renderHook(() =>
        useSuggestionApi({
          promptOptimizer: { inputPrompt: 'input' },
          stablePromptContext: null,
        })
      );

      const promise = result.current.fetchSuggestions({
        dedupKey: 'dedup-start',
        normalizedHighlight: 'highlight',
        normalizedPrompt: 'prompt',
        suggestionContext,
        metadata: null,
        allLabeledSpans: [],
        onRequestStart: () => callOrder.push('start'),
      });

      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(callOrder).toEqual(['start', 'fetch']);
    });
  });

  describe('core behavior', () => {
    it('passes span context and edit history to the API call', async () => {
      vi.useFakeTimers();
      mockFetchEnhancementSuggestions.mockResolvedValue({
        suggestions: ['A'],
        isPlaceholder: false,
      });

      const { result } = renderHook(() =>
        useSuggestionApi({
          promptOptimizer: { inputPrompt: 'input' },
          stablePromptContext: { format: 'video' },
        })
      );

      const promise = result.current.fetchSuggestions({
        dedupKey: 'dedup-api',
        normalizedHighlight: 'highlight',
        normalizedPrompt: 'prompt',
        suggestionContext,
        metadata: { category: 'style' },
        allLabeledSpans: [{ id: 'span-1' }],
      });

      expect(result.current.isRequestInFlight('dedup-api')).toBe(true);

      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(mockPrepareSpanContext).toHaveBeenCalledWith(
        { category: 'style' },
        [{ id: 'span-1' }]
      );

      expect(mockFetchEnhancementSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          highlightedText: 'highlight',
          contextBefore: 'before',
          contextAfter: 'after',
          fullPrompt: 'prompt',
          inputPrompt: 'input',
          brainstormContext: { format: 'video' },
          metadata: { category: 'style' },
          allLabeledSpans: [{ text: 'span-a' }],
          nearbySpans: [{ text: 'span-b' }],
          editHistory: [{ id: 'edit-1' }],
        })
      );

      expect(result.current.isRequestInFlight('dedup-api')).toBe(false);
    });
  });
});
