import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { LLMClient } from '@clients/LLMClient';
import type { AIResponse } from '@interfaces/IAIClient';
import { StoryboardFramePlanner } from '../StoryboardFramePlanner';
import { fetchImageAsDataUrl } from '../fetchImageAsDataUrl';

vi.mock('../fetchImageAsDataUrl', () => ({
  fetchImageAsDataUrl: vi.fn(),
}));

const buildResponse = (text: string): AIResponse => ({
  text,
  metadata: {},
});

const createClient = (providerName: string) => {
  const completeMock: MockedFunction<
    (systemPrompt: string, options?: Record<string, unknown>) => Promise<AIResponse>
  > = vi.fn();

  const adapter = { complete: completeMock };
  const client = new LLMClient({ adapter, providerName, defaultTimeout: 1000 });

  return { client, completeMock };
};

describe('regression: storyboard planner vision fallback', () => {
  const fetchImageAsDataUrlMock = vi.mocked(fetchImageAsDataUrl);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchImageAsDataUrlMock.mockReset();
  });

  it('falls back to text planning when the vision request fails', async () => {
    const { client: textClient, completeMock: textComplete } = createClient('text-llm');
    const { client: visionClient, completeMock: visionComplete } = createClient('vision-llm');

    fetchImageAsDataUrlMock.mockResolvedValueOnce('data:image/png;base64,AAAA');
    visionComplete.mockRejectedValueOnce(new Error('vision timeout'));
    textComplete.mockResolvedValueOnce(
      buildResponse('{"deltas": ["text delta 1", "text delta 2", "text delta 3"]}')
    );

    const planner = new StoryboardFramePlanner({
      llmClient: textClient,
      visionLlmClient: visionClient,
    });

    const result = await planner.planDeltas('prompt', 4, 'https://example.com/base.webp');

    expect(result).toEqual(['text delta 1', 'text delta 2', 'text delta 3']);
    expect(visionComplete).toHaveBeenCalledTimes(1);
    expect(textComplete).toHaveBeenCalledTimes(1);
  });

  it('falls back to text repair when the vision repair request fails', async () => {
    const { client: textClient, completeMock: textComplete } = createClient('text-llm');
    const { client: visionClient, completeMock: visionComplete } = createClient('vision-llm');

    fetchImageAsDataUrlMock.mockResolvedValue('data:image/png;base64,AAAA');
    visionComplete
      .mockResolvedValueOnce(buildResponse('not valid json'))
      .mockRejectedValueOnce(new Error('vision repair timeout'));
    textComplete.mockResolvedValueOnce(
      buildResponse('{"deltas": ["repair delta 1", "repair delta 2", "repair delta 3"]}')
    );

    const planner = new StoryboardFramePlanner({
      llmClient: textClient,
      visionLlmClient: visionClient,
    });

    const result = await planner.planDeltas('prompt', 4, 'https://example.com/base.webp');

    expect(result).toEqual(['repair delta 1', 'repair delta 2', 'repair delta 3']);
    expect(visionComplete).toHaveBeenCalledTimes(2);
    expect(textComplete).toHaveBeenCalledTimes(1);
    expect(fetchImageAsDataUrlMock).toHaveBeenCalledTimes(2);
  });
});
