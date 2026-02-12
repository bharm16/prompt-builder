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

  const adapter = {
    complete: completeMock,
  };

  const client = new LLMClient({ adapter, providerName, defaultTimeout: 1000 });
  return { client, completeMock };
};

describe('StoryboardFramePlanner vision path', () => {
  const fetchImageAsDataUrlMock = vi.mocked(fetchImageAsDataUrl);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchImageAsDataUrlMock.mockReset();
  });

  it('uses the vision client when baseImageUrl is provided', async () => {
    const { client: textClient, completeMock: textComplete } = createClient('test-text-llm');
    const { client: visionClient, completeMock: visionComplete } = createClient('test-vision-llm');
    fetchImageAsDataUrlMock.mockResolvedValueOnce('data:image/png;base64,AAAA');
    visionComplete.mockResolvedValueOnce(
      buildResponse('{"deltas": ["move foot forward", "shift weight", "extend arm"]}')
    );

    const planner = new StoryboardFramePlanner({
      llmClient: textClient,
      visionLlmClient: visionClient,
    });
    const result = await planner.planDeltas('prompt', 4, 'https://example.com/base.webp');

    expect(result).toEqual(['move foot forward', 'shift weight', 'extend arm']);
    expect(fetchImageAsDataUrlMock).toHaveBeenCalledWith('https://example.com/base.webp', {
      timeoutMs: 8000,
    });
    expect(visionComplete).toHaveBeenCalledTimes(1);
    expect(textComplete).not.toHaveBeenCalled();

    const callOptions = visionComplete.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callOptions).toMatchObject({
      maxTokens: 400,
      temperature: 0.4,
      jsonMode: true,
    });
    expect(callOptions).toHaveProperty('messages');
    const messages = callOptions.messages as Array<{ role: string; content: unknown }>;
    const userMessage = messages.find((message) => message.role === 'user');
    expect(Array.isArray(userMessage?.content)).toBe(true);
  });

  it('falls back to text-only when image fetch fails with text-plan defaults', async () => {
    const { client: textClient, completeMock: textComplete } = createClient('test-text-llm');
    const { client: visionClient, completeMock: visionComplete } = createClient('test-vision-llm');
    fetchImageAsDataUrlMock.mockRejectedValueOnce(new Error('fetch failed'));
    textComplete.mockResolvedValueOnce(
      buildResponse('{"deltas": ["text delta 1", "text delta 2", "text delta 3"]}')
    );

    const planner = new StoryboardFramePlanner({
      llmClient: textClient,
      visionLlmClient: visionClient,
      timeoutMs: 8123,
    });
    const result = await planner.planDeltas('prompt', 4, 'https://example.com/base.webp');

    expect(result).toEqual(['text delta 1', 'text delta 2', 'text delta 3']);
    expect(visionComplete).not.toHaveBeenCalled();
    expect(textComplete).toHaveBeenCalledTimes(1);
    expect(textComplete.mock.calls[0]?.[1]).toMatchObject({
      maxTokens: 400,
      temperature: 0.4,
      jsonMode: true,
      timeout: 8123,
    });
  });

  it('uses text-only path when no vision client is configured', async () => {
    const { client: textClient, completeMock: textComplete } = createClient('test-text-llm');
    textComplete.mockResolvedValueOnce(buildResponse('{"deltas": ["d1", "d2", "d3"]}'));

    const planner = new StoryboardFramePlanner({ llmClient: textClient });
    const result = await planner.planDeltas('prompt', 4, 'https://example.com/base.webp');

    expect(result).toEqual(['d1', 'd2', 'd3']);
    expect(textComplete).toHaveBeenCalledTimes(1);
    expect(fetchImageAsDataUrlMock).not.toHaveBeenCalled();
  });

  it('uses text-only path when baseImageUrl is not provided even with vision client', async () => {
    const { client: textClient, completeMock: textComplete } = createClient('test-text-llm');
    const { client: visionClient, completeMock: visionComplete } = createClient('test-vision-llm');
    textComplete.mockResolvedValueOnce(buildResponse('{"deltas": ["d1", "d2", "d3"]}'));

    const planner = new StoryboardFramePlanner({
      llmClient: textClient,
      visionLlmClient: visionClient,
    });
    const result = await planner.planDeltas('prompt', 4);

    expect(result).toEqual(['d1', 'd2', 'd3']);
    expect(textComplete).toHaveBeenCalledTimes(1);
    expect(visionComplete).not.toHaveBeenCalled();
    expect(fetchImageAsDataUrlMock).not.toHaveBeenCalled();
  });
});
