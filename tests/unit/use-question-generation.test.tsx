import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useQuestionGeneration } from '@/PromptImprovementForm/hooks/useQuestionGeneration';
import type { Question } from '@/PromptImprovementForm/types';
import { sanitizeError } from '@/utils/logging';
import { fetchGeneratedQuestions } from '@/PromptImprovementForm/api';
import { generateFallbackQuestions } from '@/PromptImprovementForm/utils/questionGeneration';

vi.mock('@/PromptImprovementForm/api', () => ({
  fetchGeneratedQuestions: vi.fn(),
}));

vi.mock('@/PromptImprovementForm/utils/questionGeneration', () => ({
  generateFallbackQuestions: vi.fn(),
}));

const childLogger = {
  error: vi.fn(),
};

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: vi.fn(() => childLogger),
  },
}));

vi.mock('@/utils/logging', () => ({
  sanitizeError: vi.fn(() => ({ message: 'sanitized' })),
}));

describe('useQuestionGeneration', () => {
  const mockFetchGeneratedQuestions = vi.mocked(fetchGeneratedQuestions);
  const mockGenerateFallbackQuestions = vi.mocked(generateFallbackQuestions);
  const mockSanitizeError = vi.mocked(sanitizeError);

  const fallbackQuestions: Question[] = [
    {
      id: 1,
      title: 'Fallback one',
      description: 'Fallback description',
      field: 'specificAspects',
      examples: ['A'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    childLogger.error.mockClear();
  });

  describe('error handling', () => {
    it('sets error and fallback questions when fetch fails', async () => {
      mockFetchGeneratedQuestions.mockRejectedValueOnce(new Error('Network down'));
      mockGenerateFallbackQuestions.mockReturnValue(fallbackQuestions);

      const { result } = renderHook(() => useQuestionGeneration('Test prompt'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe('Network down');
      expect(result.current.questions).toEqual(fallbackQuestions);
    });

    it('logs sanitized errors when rejection is not an Error instance', async () => {
      mockFetchGeneratedQuestions.mockRejectedValueOnce('bad');
      mockGenerateFallbackQuestions.mockReturnValue(fallbackQuestions);

      const { result } = renderHook(() => useQuestionGeneration('Prompt'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe('Unknown error');
      expect(mockSanitizeError).toHaveBeenCalledWith('bad');
      expect(childLogger.error).toHaveBeenCalledWith(
        'Error fetching questions',
        expect.objectContaining({ message: 'sanitized' }),
        expect.objectContaining({ operation: 'loadQuestions', promptLength: 6 })
      );
    });

    it('keeps loading state false when fallback generation succeeds after error', async () => {
      mockFetchGeneratedQuestions.mockRejectedValueOnce(new Error('API down'));
      mockGenerateFallbackQuestions.mockReturnValue(fallbackQuestions);

      const { result } = renderHook(() => useQuestionGeneration('Test prompt'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.questions).toEqual(fallbackQuestions);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('does not attempt fetch when initial prompt is empty', () => {
      const { result } = renderHook(() => useQuestionGeneration(''));

      expect(mockFetchGeneratedQuestions).not.toHaveBeenCalled();
      expect(result.current.questions).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns generated questions on success', async () => {
      const generated: Question[] = [
        {
          id: 1,
          title: 'Generated',
          description: 'Generated description',
          field: 'specificAspects',
          examples: ['Example'],
        },
      ];
      mockFetchGeneratedQuestions.mockResolvedValueOnce(generated);

      const { result } = renderHook(() => useQuestionGeneration('Create a summary'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.questions).toEqual(generated);
      expect(result.current.error).toBeNull();
    });
  });
});
