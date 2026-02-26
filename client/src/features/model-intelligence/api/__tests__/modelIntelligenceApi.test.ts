import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchModelRecommendation } from '../modelIntelligenceApi';

const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    post: apiPostMock,
  },
}));

const validRecommendation = {
  promptId: 'prompt-1',
  prompt: 'A cinematic runner through rain',
  recommendations: [],
  recommended: {
    modelId: 'sora-2',
    confidence: 'high',
    reasoning: 'Best match',
  },
  suggestComparison: false,
};

describe('fetchModelRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed recommendation data for successful response', async () => {
    apiPostMock.mockResolvedValue({
      success: true,
      data: validRecommendation,
    });

    const result = await fetchModelRecommendation({
      prompt: 'A cinematic runner through rain',
      mode: 't2v',
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/model-intelligence/recommend',
      expect.objectContaining({ mode: 't2v' }),
      undefined
    );
    expect(result).toMatchObject(validRecommendation);
  });

  it('passes AbortSignal to api client when provided', async () => {
    apiPostMock.mockResolvedValue({
      success: true,
      data: validRecommendation,
    });
    const controller = new AbortController();

    await fetchModelRecommendation(
      { prompt: 'A cinematic runner through rain' },
      controller.signal
    );

    expect(apiPostMock).toHaveBeenCalledWith(
      '/model-intelligence/recommend',
      expect.any(Object),
      { signal: controller.signal }
    );
  });

  it('throws with API error message when response marks failure', async () => {
    apiPostMock.mockResolvedValue({
      success: false,
      error: 'upstream unavailable',
    });

    await expect(
      fetchModelRecommendation({ prompt: 'A cinematic runner through rain' })
    ).rejects.toThrow('upstream unavailable');
  });

  it('throws when API response shape is invalid', async () => {
    apiPostMock.mockResolvedValue({
      ok: true,
      payload: { not: 'schema-compatible' },
    });

    await expect(
      fetchModelRecommendation({ prompt: 'A cinematic runner through rain' })
    ).rejects.toThrow();
  });
});
