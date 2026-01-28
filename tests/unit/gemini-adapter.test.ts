import { describe, expect, it, vi } from 'vitest';

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

vi.mock('opossum', () => ({
  default: class FakeBreaker {
    private readonly fn: (...args: unknown[]) => Promise<unknown>;
    constructor(fn: (...args: unknown[]) => Promise<unknown>) {
      this.fn = fn;
    }
    fire(...args: unknown[]) {
      return this.fn(...args);
    }
    fallback() {
      return this;
    }
    on() {
      return this;
    }
  },
}));

import { GeminiAdapter } from '@clients/adapters/GeminiAdapter';
import type { AIResponse } from '@clients/adapters/gemini/types';

describe('GeminiAdapter', () => {
  describe('error handling', () => {
    it('throws when api key is missing', () => {
      expect(() => new GeminiAdapter({ apiKey: '', defaultModel: 'gemini-pro' })).toThrow(
        'API key required'
      );
    });

    it('throws when structured output returns empty text', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'key', defaultModel: 'gemini-pro' });
      vi.spyOn(adapter, 'complete').mockResolvedValue({ text: '', metadata: {} } as AIResponse);

      await expect(adapter.generateStructuredOutput('Prompt', { type: 'object' })).rejects.toThrow(
        'Empty response from Gemini for structured output'
      );
    });
  });

  describe('edge cases', () => {
    it('logs and throws when structured output JSON is invalid', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'key', defaultModel: 'gemini-pro' });
      vi.spyOn(adapter, 'complete').mockResolvedValue({
        text: '{invalid',
        metadata: {},
      } as AIResponse);

      await expect(adapter.generateStructuredOutput('Prompt', { type: 'object' })).rejects.toThrow(
        'Invalid JSON response from Gemini'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('parses structured output JSON responses', async () => {
      const adapter = new GeminiAdapter({ apiKey: 'key', defaultModel: 'gemini-pro' });
      vi.spyOn(adapter, 'complete').mockResolvedValue({
        text: '{"ok":true}',
        metadata: {},
      } as AIResponse);

      await expect(adapter.generateStructuredOutput('Prompt', { type: 'object' })).resolves.toEqual({
        ok: true,
      });
    });
  });
});
