/**
 * Unit tests for PromptEnhancementEditor enhancementApi
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchEnhancementSuggestions } from '@components/PromptEnhancementEditor/api/enhancementApi';
import { postEnhancementSuggestions } from '@/api/enhancementSuggestionsApi';
import { logger } from '@/services/LoggingService';
import type { EnhancementSuggestionPayload } from '@components/PromptEnhancementEditor/utils/suggestionPayload';
import type { Suggestion } from '@components/PromptEnhancementEditor/types';

vi.mock('@/api/enhancementSuggestionsApi', () => ({
  postEnhancementSuggestions: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const mockPostEnhancementSuggestions = vi.mocked(postEnhancementSuggestions);
const mockLogger = vi.mocked(logger);

const baseRequest: EnhancementSuggestionPayload = {
  highlightedText: 'sunlit alley',
  contextBefore: 'A lonely road and',
  contextAfter: 'with shadows',
  fullPrompt: 'A lonely road and sunlit alley with shadows',
  highlightedCategory: 'lighting',
  highlightedCategoryConfidence: 0.82,
  highlightedPhrase: 'sunlit alley',
};

describe('fetchEnhancementSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('logs context and rethrows when the API fails', async () => {
      const error = new Error('Network failure');
      mockPostEnhancementSuggestions.mockRejectedValue(error);

      await expect(fetchEnhancementSuggestions(baseRequest)).rejects.toThrow('Network failure');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error fetching suggestions',
        error,
        expect.objectContaining({
          component: 'enhancementApi',
          operation: 'fetchEnhancementSuggestions',
          highlightedText: baseRequest.highlightedText,
          highlightCategory: baseRequest.highlightedCategory,
        })
      );
    });
  });

  describe('edge cases', () => {
    it('defaults missing suggestions and placeholder flags', async () => {
      mockPostEnhancementSuggestions.mockResolvedValue(
        {} as Awaited<ReturnType<typeof postEnhancementSuggestions>>
      );

      const result = await fetchEnhancementSuggestions(baseRequest);

      expect(result).toEqual({
        suggestions: [],
        isPlaceholder: false,
      });
    });
  });

  describe('core behavior', () => {
    it('returns normalized suggestions payload on success', async () => {
      const suggestions: Suggestion[] = [{ text: 'Add golden hour glow' }];
      mockPostEnhancementSuggestions.mockResolvedValue({
        suggestions,
        isPlaceholder: true,
      });

      const result = await fetchEnhancementSuggestions(baseRequest);

      expect(result.suggestions).toEqual(suggestions);
      expect(result.isPlaceholder).toBe(true);
    });
  });
});
