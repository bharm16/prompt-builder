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

import { GroqLlamaAdapter } from '@clients/adapters/GroqLlamaAdapter';

describe('GroqLlamaAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('throws when api key is missing', () => {
      expect(() => new GroqLlamaAdapter({ apiKey: '' })).toThrow('Groq API key required');
    });
  });

  describe('edge cases', () => {
    it('injects JSON instructions when using json_object mode', async () => {
      const adapter = new GroqLlamaAdapter({ apiKey: 'key', defaultModel: 'llama-3.1-70b' });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
          }),
          { status: 200 }
        )
      );
      global.fetch = fetchMock as typeof fetch;

      await adapter.complete('System prompt', {
        jsonMode: true,
        responseFormat: { type: 'json_object' },
        enableSandwich: false,
      });

      const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
      const systemMessage = payload.messages[0]?.content as string;

      expect(systemMessage.startsWith('Respond with valid JSON.')).toBe(true);
      expect(systemMessage).toContain('System prompt');
    });
  });

  describe('core behavior', () => {
    it('prefixes prefilled JSON responses with opening brace', async () => {
      const adapter = new GroqLlamaAdapter({ apiKey: 'key', defaultModel: 'llama-3.1-70b' });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '"a":1}' } }],
          }),
          { status: 200 }
        )
      );
      global.fetch = fetchMock as typeof fetch;

      const response = await adapter.complete('System prompt', { jsonMode: true });

      expect(response.text).toBe('{"a":1}');
      expect(response.metadata.provider).toBe('groq');
    });
  });
});
