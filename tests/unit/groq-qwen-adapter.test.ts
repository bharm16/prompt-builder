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

import { GroqQwenAdapter } from '@clients/adapters/GroqQwenAdapter';

describe('GroqQwenAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('throws when api key is missing', () => {
      expect(() => new GroqQwenAdapter({ apiKey: '' })).toThrow('Groq API key required');
    });
  });

  describe('edge cases', () => {
    it('forces json_object mode and reasoning_effort for structured output', async () => {
      const adapter = new GroqQwenAdapter({ apiKey: 'key' });
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
        schema: { type: 'object' },
        jsonMode: true,
      });

      const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
      expect(payload.response_format).toEqual({ type: 'json_object' });
      expect(payload.reasoning_effort).toBe('none');
      expect((payload.messages[0]?.content as string).startsWith('Respond with valid JSON.')).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('normalizes responses with qwen metadata', async () => {
      const adapter = new GroqQwenAdapter({ apiKey: 'key' });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Result' }, finish_reason: 'stop' }],
          }),
          { status: 200 }
        )
      );
      global.fetch = fetchMock as typeof fetch;

      const response = await adapter.complete('System prompt', {
        userMessage: 'Hello',
      });

      expect(response.text).toBe('Result');
      expect(response.metadata.provider).toBe('groq-qwen');
      expect(response.metadata.optimizations).toContain('qwen3-reasoning-effort');
    });
  });
});
