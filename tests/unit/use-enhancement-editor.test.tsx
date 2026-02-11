/**
 * Unit tests for useEnhancementEditor
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useEnhancementEditor } from '@components/PromptEnhancementEditor/hooks/useEnhancementEditor';
import { fetchEnhancementSuggestions } from '@components/PromptEnhancementEditor/api/enhancementApi';
import { detectAndApplySceneChange } from '@/utils/sceneChange';

vi.mock('@components/PromptEnhancementEditor/api/enhancementApi', () => ({
  fetchEnhancementSuggestions: vi.fn(),
}));

vi.mock('@/utils/sceneChange', () => ({
  detectAndApplySceneChange: vi.fn(),
}));

vi.mock('@hooks/useDebugLogger', () => ({
  useDebugLogger: () => ({
    logAction: vi.fn(),
    logEffect: vi.fn(),
    logError: vi.fn(),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  }),
}));

const mockFetchEnhancementSuggestions = vi.mocked(fetchEnhancementSuggestions);
const mockDetectAndApplySceneChange = vi.mocked(detectAndApplySceneChange);

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useEnhancementEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('surfaces a fallback suggestion when fetch fails', async () => {
      const onPromptUpdate = vi.fn();
      const onShowSuggestionsChange = vi.fn();

      const container = document.createElement('div');
      const highlight = document.createElement('span');
      highlight.setAttribute('data-category', 'tone');
      highlight.textContent = 'Bright';
      container.appendChild(highlight);

      const range = document.createRange();
      range.selectNodeContents(highlight);

      const selection = {
        anchorNode: highlight.firstChild,
        focusNode: highlight.firstChild,
        toString: () => 'Bright',
        rangeCount: 1,
        getRangeAt: vi.fn(() => range),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      } as unknown as Selection;

      vi.spyOn(window, 'getSelection').mockReturnValue(selection);

      mockFetchEnhancementSuggestions.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() =>
        useEnhancementEditor({
          promptContent: 'Bright scene',
          onPromptUpdate,
          onShowSuggestionsChange,
        })
      );

      result.current.contentRef.current = container;

      await act(async () => {
        await result.current.handleMouseUp();
      });

      await waitFor(() => {
        const latestState = onShowSuggestionsChange.mock.calls.at(-1)?.[0];
        expect(latestState?.suggestions?.[0]?.text).toBe(
          'Failed to load suggestions. Please try again.'
        );
        expect(latestState?.isPlaceholder).toBe(false);
        expect(latestState?.isLoading).toBe(false);
      });

    });
  });

  describe('edge cases', () => {
    it('does nothing when selection is outside the content ref', async () => {
      const onPromptUpdate = vi.fn();
      const onShowSuggestionsChange = vi.fn();
      const container = document.createElement('div');
      const external = document.createElement('span');
      external.textContent = 'External';

      const selection = {
        anchorNode: external.firstChild,
        focusNode: external.firstChild,
        toString: () => 'External',
        rangeCount: 0,
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      } as unknown as Selection;

      vi.spyOn(window, 'getSelection').mockReturnValue(selection);

      const { result } = renderHook(() =>
        useEnhancementEditor({
          promptContent: 'Inside',
          onPromptUpdate,
          onShowSuggestionsChange,
        })
      );

      result.current.contentRef.current = container;

      await act(async () => {
        await result.current.handleMouseUp();
      });

      expect(mockFetchEnhancementSuggestions).not.toHaveBeenCalled();
      expect(onShowSuggestionsChange).toHaveBeenCalled();
      const latestState = onShowSuggestionsChange.mock.calls.at(-1)?.[0];
      expect(latestState).toMatchObject({
        show: false,
        selectedText: '',
        fullPrompt: 'Inside',
      });
    });
  });

  describe('core behavior', () => {
    it('fetches suggestions for cleaned selections and restores selection', async () => {
      const onPromptUpdate = vi.fn();
      const onShowSuggestionsChange = vi.fn();

      const container = document.createElement('div');
      const highlight = document.createElement('span');
      highlight.setAttribute('data-category', 'lighting');
      highlight.setAttribute('data-confidence', '0.9');
      highlight.setAttribute('data-phrase', 'Bright light');
      highlight.textContent = 'Bright light';
      container.appendChild(highlight);

      const range = document.createRange();
      range.selectNodeContents(highlight);

      const selection = {
        anchorNode: highlight.firstChild,
        focusNode: highlight.firstChild,
        toString: () => '- Bright light',
        rangeCount: 1,
        getRangeAt: vi.fn(() => range),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      } as unknown as Selection;

      vi.spyOn(window, 'getSelection').mockReturnValue(selection);

      mockFetchEnhancementSuggestions.mockResolvedValue({
        suggestions: [{ text: 'Add warm glow' }],
        isPlaceholder: true,
      });

      const { result } = renderHook(() =>
        useEnhancementEditor({
          promptContent: 'A - Bright light fills the room',
          onPromptUpdate,
          originalUserPrompt: 'Original',
          onShowSuggestionsChange,
        })
      );

      result.current.contentRef.current = container;

      await act(async () => {
        await result.current.handleMouseUp();
      });

      await waitFor(() => {
        expect(mockFetchEnhancementSuggestions).toHaveBeenCalledWith(
          expect.objectContaining({
            highlightedText: 'Bright light',
            highlightedCategory: 'lighting',
            highlightedCategoryConfidence: 0.9,
          })
        );
      });

      await waitFor(() => {
        const latestState = onShowSuggestionsChange.mock.calls.at(-1)?.[0];
        expect(latestState?.selectedText).toBe('Bright light');
        expect(latestState?.suggestions).toHaveLength(1);
        expect(latestState?.isPlaceholder).toBe(true);
      });

      await waitFor(() => {
        expect(selection.addRange).toHaveBeenCalledWith(expect.any(Range));
      });

      const latestState = onShowSuggestionsChange.mock.calls.at(-1)?.[0];
      mockDetectAndApplySceneChange.mockResolvedValue('Final prompt');

      await act(async () => {
        await latestState?.onSuggestionClick({ text: 'Add warm glow' });
      });

      expect(mockDetectAndApplySceneChange).toHaveBeenCalledWith(
        expect.objectContaining({
          originalPrompt: 'A - Bright light fills the room',
          updatedPrompt: 'A - Add warm glow fills the room',
          oldValue: 'Bright light',
          newValue: 'Add warm glow',
        })
      );
      expect(onPromptUpdate).toHaveBeenCalledWith('Final prompt');
    });

    it('keeps latest suggestion response when requests resolve out of order', async () => {
      const onPromptUpdate = vi.fn();
      const onShowSuggestionsChange = vi.fn();

      const container = document.createElement('div');
      const firstHighlight = document.createElement('span');
      firstHighlight.setAttribute('data-category', 'lighting');
      firstHighlight.textContent = 'Bright light';
      container.appendChild(firstHighlight);

      const secondHighlight = document.createElement('span');
      secondHighlight.setAttribute('data-category', 'environment');
      secondHighlight.textContent = 'Dark alley';
      container.appendChild(secondHighlight);

      const firstRange = document.createRange();
      firstRange.selectNodeContents(firstHighlight);
      const secondRange = document.createRange();
      secondRange.selectNodeContents(secondHighlight);

      const firstSelection = {
        anchorNode: firstHighlight.firstChild,
        focusNode: firstHighlight.firstChild,
        toString: () => 'Bright light',
        rangeCount: 1,
        getRangeAt: vi.fn(() => firstRange),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      } as unknown as Selection;

      const secondSelection = {
        anchorNode: secondHighlight.firstChild,
        focusNode: secondHighlight.firstChild,
        toString: () => 'Dark alley',
        rangeCount: 1,
        getRangeAt: vi.fn(() => secondRange),
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
      } as unknown as Selection;

      let activeSelection = firstSelection;
      vi.spyOn(window, 'getSelection').mockImplementation(() => activeSelection);

      const firstDeferred = createDeferred<{
        suggestions: Array<{ text: string }>;
        isPlaceholder: boolean;
      }>();
      const secondDeferred = createDeferred<{
        suggestions: Array<{ text: string }>;
        isPlaceholder: boolean;
      }>();

      mockFetchEnhancementSuggestions.mockImplementation((payload) => {
        if (payload.highlightedText === 'Bright light') {
          return firstDeferred.promise;
        }
        return secondDeferred.promise;
      });

      const { result } = renderHook(() =>
        useEnhancementEditor({
          promptContent: 'Bright light then Dark alley',
          onPromptUpdate,
          onShowSuggestionsChange,
        })
      );
      result.current.contentRef.current = container;

      let firstRequestPromise: Promise<void> | null = null;
      await act(async () => {
        firstRequestPromise = result.current.handleMouseUp();
        await Promise.resolve();
      });

      activeSelection = secondSelection;
      let secondRequestPromise: Promise<void> | null = null;
      await act(async () => {
        secondRequestPromise = result.current.handleMouseUp();
        await Promise.resolve();
      });

      await act(async () => {
        secondDeferred.resolve({
          suggestions: [{ text: 'Replace with moody corridor' }],
          isPlaceholder: false,
        });
        await secondRequestPromise;
      });

      await act(async () => {
        firstDeferred.resolve({
          suggestions: [{ text: 'Replace with warm sunrise' }],
          isPlaceholder: false,
        });
        await firstRequestPromise;
      });

      await waitFor(() => {
        const latestState = onShowSuggestionsChange.mock.calls.at(-1)?.[0];
        expect(latestState?.selectedText).toBe('Dark alley');
        expect(latestState?.suggestions).toEqual([
          { text: 'Replace with moody corridor' },
        ]);
      });

      const sawLoadingState = onShowSuggestionsChange.mock.calls.some(
        ([state]) => state?.isLoading === true
      );
      expect(sawLoadingState).toBe(true);
    });
  });
});
