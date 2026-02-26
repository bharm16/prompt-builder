import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelRecommendation } from '../useModelRecommendation';
import { fetchModelRecommendation } from '@features/model-intelligence/api';

vi.mock('@features/model-intelligence/api', () => ({
  fetchModelRecommendation: vi.fn(),
}));

const mockFetchModelRecommendation = vi.mocked(fetchModelRecommendation);

describe('useModelRecommendation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips requests when prompt length is below recommendation threshold', () => {
    const { result } = renderHook(() =>
      useModelRecommendation('short', { debounceMs: 50 })
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockFetchModelRecommendation).not.toHaveBeenCalled();
    expect(result.current.recommendation).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('loads recommendation after debounce and stores result', async () => {
    mockFetchModelRecommendation.mockResolvedValue({
      promptId: 'prompt-1',
      prompt: 'A cinematic runner through rain',
      recommendations: [],
      recommended: {
        modelId: 'sora-2',
        confidence: 'high',
        reasoning: 'Best match',
      },
      suggestComparison: false,
    });

    const { result } = renderHook(() =>
      useModelRecommendation('A cinematic runner through rain', {
        mode: 't2v',
        debounceMs: 75,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(75);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.recommendation?.recommended.modelId).toBe('sora-2');
  });

  it('stores error message when recommendation request fails', async () => {
    mockFetchModelRecommendation.mockRejectedValue(new Error('request failed'));

    const { result } = renderHook(() =>
      useModelRecommendation('A cinematic runner through rain', { debounceMs: 20 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error).toBe('request failed');
    expect(result.current.recommendation).toBeNull();
  });

  it('supports manual refetch', async () => {
    mockFetchModelRecommendation.mockResolvedValue({
      promptId: 'prompt-2',
      prompt: 'A cinematic runner through rain',
      recommendations: [],
      recommended: {
        modelId: 'luma-ray3',
        confidence: 'medium',
        reasoning: 'Good fallback',
      },
      suggestComparison: false,
    });

    const { result } = renderHook(() =>
      useModelRecommendation('A cinematic runner through rain', { debounceMs: 10_000 })
    );

    expect(mockFetchModelRecommendation).not.toHaveBeenCalled();

    await act(async () => {
      result.current.refetch();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(1);
    expect(result.current.recommendation?.recommended.modelId).toBe('luma-ray3');
  });

  it('aborts in-flight request when prompt changes', async () => {
    const signals: AbortSignal[] = [];
    mockFetchModelRecommendation.mockImplementation(async (_payload, signal) => {
      if (signal) signals.push(signal);
      return {
        promptId: 'prompt-3',
        prompt: 'prompt',
        recommendations: [],
        recommended: {
          modelId: 'sora-2',
          confidence: 'high',
          reasoning: 'Best',
        },
        suggestComparison: false,
      };
    });

    const { rerender } = renderHook(
      ({ prompt }) => useModelRecommendation(prompt, { debounceMs: 25 }),
      { initialProps: { prompt: 'A cinematic runner through rain' } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });
    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(1);

    rerender({ prompt: 'A cinematic runner through snow' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });

    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });
});
