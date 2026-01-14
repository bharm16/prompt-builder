/**
 * Unit tests for Enhancement Suggestions API
 *
 * Tests cancellation, timeout, and error handling behavior.
 * Validates Requirements: 1.4, 1.5, 3.4, 3.5
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchEnhancementSuggestions } from '@features/prompt-optimizer/api/enhancementSuggestionsApi';
import { CancellationError } from '@features/prompt-optimizer/utils/signalUtils';
import {
  postEnhancementSuggestions,
  type EnhancementSuggestionsResponse,
} from '@/api/enhancementSuggestionsApi';

vi.mock('@/api/enhancementSuggestionsApi', () => ({
  postEnhancementSuggestions: vi.fn(),
}));

const mockPostEnhancementSuggestions = vi.mocked(postEnhancementSuggestions);

const TIMEOUT_MS = 8000;

const defaultParams = {
  highlightedText: 'test text',
  contextBefore: 'before test text',
  contextAfter: 'after test text',
  fullPrompt: 'before test text after test text',
  inputPrompt: 'before test text after test text',
};

const mockSuccessResponse: EnhancementSuggestionsResponse = {
  suggestions: ['suggestion 1', 'suggestion 2'],
  isPlaceholder: false,
};

function createAbortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function mockAbortableRequest(): void {
  mockPostEnhancementSuggestions.mockImplementation((_payload, options) => {
    return new Promise((_resolve, reject) => {
      const signal = options?.signal;
      if (!signal) {
        return;
      }
      if (signal.aborted) {
        reject(createAbortError());
        return;
      }
      signal.addEventListener('abort', () => {
        reject(createAbortError());
      });
    }) as Promise<EnhancementSuggestionsResponse>;
  });
}

describe('fetchEnhancementSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('timeout behavior', () => {
    it('should throw timeout error after 8 seconds', async () => {
      vi.useFakeTimers();
      mockAbortableRequest();

      const promise = fetchEnhancementSuggestions(defaultParams);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

      await expect(promise).rejects.toThrow('Request timed out after 8 seconds');
    });

    it('should not timeout if response arrives quickly', async () => {
      mockPostEnhancementSuggestions.mockResolvedValue(mockSuccessResponse);

      const result = await fetchEnhancementSuggestions(defaultParams);

      expect(result.suggestions).toEqual(['suggestion 1', 'suggestion 2']);
      expect(result.isPlaceholder).toBe(false);
    });

    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      mockPostEnhancementSuggestions.mockResolvedValue(mockSuccessResponse);

      await fetchEnhancementSuggestions(defaultParams);

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('external signal cancellation', () => {
    it('should throw CancellationError when external signal is aborted', async () => {
      mockAbortableRequest();
      const externalController = new AbortController();

      const promise = fetchEnhancementSuggestions({
        ...defaultParams,
        signal: externalController.signal,
      });

      externalController.abort();

      await expect(promise).rejects.toThrow(CancellationError);
      await expect(promise).rejects.toThrow('Request cancelled by user');
    });

    it('should pass combined signal to postEnhancementSuggestions', async () => {
      const externalController = new AbortController();
      mockPostEnhancementSuggestions.mockResolvedValue(mockSuccessResponse);

      await fetchEnhancementSuggestions({
        ...defaultParams,
        signal: externalController.signal,
      });

      expect(mockPostEnhancementSuggestions).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('timeout vs user cancellation distinction', () => {
    it('should throw regular Error for timeout (not CancellationError)', async () => {
      vi.useFakeTimers();
      mockAbortableRequest();

      const promise = fetchEnhancementSuggestions(defaultParams);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

      await expect(promise).rejects.not.toThrow(CancellationError);
      await expect(promise).rejects.toThrow('Request timed out after 8 seconds');
    });

    it('should throw CancellationError for user cancellation (not timeout error)', async () => {
      mockAbortableRequest();
      const externalController = new AbortController();

      const promise = fetchEnhancementSuggestions({
        ...defaultParams,
        signal: externalController.signal,
      });

      externalController.abort();

      await expect(promise).rejects.toThrow(CancellationError);
    });
  });

  describe('error handling', () => {
    it('should re-throw non-abort errors as-is', async () => {
      const networkError = new Error('Network failure');
      mockPostEnhancementSuggestions.mockRejectedValue(networkError);

      await expect(fetchEnhancementSuggestions(defaultParams)).rejects.toThrow('Network failure');
    });

    it('should clear timeout on error', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      mockPostEnhancementSuggestions.mockRejectedValue(new Error('Network error'));

      await expect(fetchEnhancementSuggestions(defaultParams)).rejects.toThrow();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('successful response', () => {
    it('should return suggestions and isPlaceholder from response', async () => {
      mockPostEnhancementSuggestions.mockResolvedValue(mockSuccessResponse);

      const result = await fetchEnhancementSuggestions(defaultParams);

      expect(result).toEqual({
        suggestions: ['suggestion 1', 'suggestion 2'],
        isPlaceholder: false,
      });
    });

    it('should handle empty suggestions array', async () => {
      mockPostEnhancementSuggestions.mockResolvedValue({
        isPlaceholder: true,
        suggestions: [],
      });

      const result = await fetchEnhancementSuggestions(defaultParams);

      expect(result.suggestions).toEqual([]);
      expect(result.isPlaceholder).toBe(true);
    });

    it('should handle false placeholder flag', async () => {
      mockPostEnhancementSuggestions.mockResolvedValue({
        suggestions: ['test'],
        isPlaceholder: false,
      });

      const result = await fetchEnhancementSuggestions(defaultParams);

      expect(result.isPlaceholder).toBe(false);
    });
  });

  describe('request payload', () => {
    it('should include all required fields in request body', async () => {
      const brainstormContext = { toJSON: () => ({ idea: 'brainstorm' }) };
      mockPostEnhancementSuggestions.mockResolvedValue(mockSuccessResponse);

      await fetchEnhancementSuggestions({
        ...defaultParams,
        metadata: { category: 'test-category', confidence: 0.9, quote: 'quoted' },
        brainstormContext,
        allLabeledSpans: [{ text: 'a' }],
        nearbySpans: [{ text: 'b' }],
        editHistory: [{ text: 'c' }],
      });

      expect(mockPostEnhancementSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          highlightedText: 'test text',
          contextBefore: 'before test text',
          contextAfter: 'after test text',
          fullPrompt: defaultParams.fullPrompt,
          originalUserPrompt: defaultParams.inputPrompt,
          highlightedCategory: 'test-category',
          highlightedCategoryConfidence: 0.9,
          highlightedPhrase: 'quoted',
          brainstormContext: { idea: 'brainstorm' },
          allLabeledSpans: [{ text: 'a' }],
          nearbySpans: [{ text: 'b' }],
          editHistory: [{ text: 'c' }],
        }),
        expect.any(Object)
      );
    });

    it('falls back to highlightedText when no metadata quote provided', async () => {
      mockPostEnhancementSuggestions.mockResolvedValue(mockSuccessResponse);

      await fetchEnhancementSuggestions({
        ...defaultParams,
        metadata: { category: 'test-category', confidence: 0.9 },
      });

      expect(mockPostEnhancementSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          highlightedPhrase: 'test text',
        }),
        expect.any(Object)
      );
    });
  });
});
