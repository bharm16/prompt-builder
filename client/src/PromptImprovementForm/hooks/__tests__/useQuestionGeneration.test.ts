import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFetchGeneratedQuestions,
  mockGenerateFallbackQuestions,
} = vi.hoisted(() => ({
  mockFetchGeneratedQuestions: vi.fn(),
  mockGenerateFallbackQuestions: vi.fn(),
}));

vi.mock('../../api', () => ({
  fetchGeneratedQuestions: mockFetchGeneratedQuestions,
}));

vi.mock('../../utils/questionGeneration', () => ({
  generateFallbackQuestions: mockGenerateFallbackQuestions,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { useQuestionGeneration } from '../useQuestionGeneration';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useQuestionGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads generated questions successfully', async () => {
    const generated = [
      {
        id: 1,
        title: 'Question 1',
        description: 'Description 1',
        field: 'specificAspects' as const,
        examples: ['A'],
      },
    ];

    mockFetchGeneratedQuestions.mockResolvedValue(generated);

    const { result } = renderHook(() => useQuestionGeneration('Improve this prompt'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.questions).toEqual(generated);
      expect(result.current.error).toBeNull();
    });

    expect(mockFetchGeneratedQuestions).toHaveBeenCalledWith('Improve this prompt');
    expect(mockGenerateFallbackQuestions).not.toHaveBeenCalled();
  });

  it('falls back to generated fallback questions when API fails', async () => {
    const fallback = [
      {
        id: 1,
        title: 'Fallback',
        description: 'Fallback description',
        field: 'specificAspects' as const,
        examples: ['X'],
      },
    ];

    mockFetchGeneratedQuestions.mockRejectedValue(new Error('Question API failed'));
    mockGenerateFallbackQuestions.mockReturnValue(fallback);

    const { result } = renderHook(() => useQuestionGeneration('Prompt for fallback'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Question API failed');
      expect(result.current.questions).toEqual(fallback);
    });

    expect(mockGenerateFallbackQuestions).toHaveBeenCalledWith('Prompt for fallback');
  });

  it('does not update state after unmount while request is still in flight', async () => {
    const deferred = createDeferred<
      Array<{
        id: number;
        title: string;
        description: string;
        field: 'specificAspects' | 'backgroundLevel' | 'intendedUse';
        examples: string[];
      }>
    >();

    mockFetchGeneratedQuestions.mockReturnValue(deferred.promise);

    const { unmount } = renderHook(() => useQuestionGeneration('Prompt that unmounts'));

    unmount();

    await expect(
      Promise.resolve().then(() => {
        deferred.resolve([
          {
            id: 1,
            title: 'Late',
            description: 'Late result',
            field: 'specificAspects',
            examples: ['late'],
          },
        ]);
      })
    ).resolves.toBeUndefined();
  });
});
