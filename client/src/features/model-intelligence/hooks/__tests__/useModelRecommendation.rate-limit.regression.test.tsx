import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelRecommendation } from '../useModelRecommendation';
import { fetchModelRecommendation } from '@features/model-intelligence/api';

vi.mock('@features/model-intelligence/api', () => ({
  fetchModelRecommendation: vi.fn(),
}));

const mockFetchModelRecommendation = vi.mocked(fetchModelRecommendation);

describe('regression: model recommendation backs off after rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses repeated fetches during cooldown after a 429', async () => {
    const rateLimitedError = Object.assign(new Error('Too many requests'), { status: 429 });
    mockFetchModelRecommendation.mockRejectedValue(rateLimitedError);

    const { rerender } = renderHook(
      ({ prompt }) => useModelRecommendation(prompt, { debounceMs: 25 }),
      { initialProps: { prompt: 'A cinematic runner through rain at golden hour' } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(1);

    rerender({ prompt: 'A cinematic runner through snow at dusk' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchModelRecommendation).toHaveBeenCalledTimes(2);
  });
});
