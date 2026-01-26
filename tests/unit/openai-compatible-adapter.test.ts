import { afterEach, describe, expect, it, vi } from 'vitest';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => mockLogger,
  },
}));

import { OpenAICompatibleAdapter } from '@clients/adapters/OpenAICompatibleAdapter';

const createAdapter = () =>
  new OpenAICompatibleAdapter({
    apiKey: 'key',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  });

describe('OpenAICompatibleAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('throws when api key is missing', () => {
      expect(
        () =>
          new OpenAICompatibleAdapter({
            apiKey: '',
            baseURL: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o',
          })
      ).toThrow('API key required');
    });

    it('throws APIError when the HTTP response is not ok', async () => {
      const adapter = createAdapter();
      const fetchMock = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
      global.fetch = fetchMock as typeof fetch;

      await expect(adapter.complete('System', { userMessage: 'Hello' })).rejects.toMatchObject({
        name: 'APIError',
        statusCode: 400,
        isRetryable: false,
      });
    });
  });

  describe('edge cases', () => {
    it('retries when JSON validation fails and succeeds on the next attempt', async () => {
      const adapter = createAdapter();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'not json' } }],
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"ok":true}' } }],
            }),
            { status: 200 }
          )
        );
      global.fetch = fetchMock as typeof fetch;

      const response = await adapter.complete('System', {
        jsonMode: true,
        maxRetries: 1,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(response.text).toBe('{"ok":true}');
      expect(response.metadata.validation?.isValid).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('streams responses using the stream parser', async () => {
      const adapter = createAdapter();
      const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
      global.fetch = fetchMock as typeof fetch;

      const onChunk = vi.fn();
      const parser = (adapter as unknown as { streamParser: { readStream: () => Promise<string> } })
        .streamParser;
      const readStreamSpy = vi.spyOn(parser, 'readStream').mockResolvedValue('streamed');

      const result = await adapter.streamComplete('System', { onChunk });

      expect(result).toBe('streamed');
      expect(readStreamSpy).toHaveBeenCalledWith(expect.any(Response), onChunk);
    });
  });
});
