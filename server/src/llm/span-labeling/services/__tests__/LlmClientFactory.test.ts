import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLlmClient, getCurrentSpanProvider } from '../LlmClientFactory';
import { OpenAILlmClient } from '../OpenAILlmClient';
import { GroqLlmClient } from '../GroqLlmClient';
import { GeminiLlmClient } from '../GeminiLlmClient';
import { RobustLlmClient } from '../RobustLlmClient';

const mockDetectProvider = vi.fn();
vi.mock('@utils/provider/ProviderDetector', () => ({
  detectProvider: (options: { model?: string }) => mockDetectProvider(options),
}));

describe('LlmClientFactory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockDetectProvider.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('error handling', () => {
    it('falls back to RobustLlmClient for unknown provider', () => {
      mockDetectProvider.mockReturnValue('unknown');
      const client = createLlmClient({ model: 'mystery' });
      expect(client).toBeInstanceOf(RobustLlmClient);
    });
  });

  describe('edge cases', () => {
    it('prefers explicit provider option over env detection', () => {
      process.env.SPAN_PROVIDER = 'groq';
      const client = createLlmClient({ provider: 'openai' });
      expect(client).toBeInstanceOf(OpenAILlmClient);
    });

    it('uses SPAN_PROVIDER environment variable when set', () => {
      process.env.SPAN_PROVIDER = 'gemini';
      const client = createLlmClient();
      expect(client).toBeInstanceOf(GeminiLlmClient);
    });
  });

  describe('core behavior', () => {
    it('auto-detects provider from model name when env not set', () => {
      mockDetectProvider.mockReturnValue('openai');
      process.env.SPAN_MODEL = 'gpt-4o';
      const client = createLlmClient({ model: 'gpt-4o' });
      expect(client).toBeInstanceOf(OpenAILlmClient);
    });

    it('returns current provider from configuration', () => {
      process.env.SPAN_PROVIDER = 'groq';
      expect(getCurrentSpanProvider()).toBe('groq');
      const client = createLlmClient();
      expect(client).toBeInstanceOf(GroqLlmClient);
    });
  });
});
