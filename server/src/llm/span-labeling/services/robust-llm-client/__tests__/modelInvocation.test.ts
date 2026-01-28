import { describe, it, expect, vi } from 'vitest';
import { callModel } from '../modelInvocation';

const mockFewShot = vi.fn(() => [{ role: 'assistant', content: 'example' }]);
vi.mock('../../../utils/promptBuilder', () => ({
  getFewShotExamples: () => mockFewShot(),
}));

describe('callModel', () => {
  describe('error handling', () => {
    it('falls back to content text when response.text is missing', async () => {
      const aiService = {
        execute: vi.fn().mockResolvedValue({
          content: [{ text: 'from content' }],
          metadata: { provider: 'test' },
        }),
      };

      const result = await callModel({
        systemPrompt: 'sys',
        userPayload: '{"text":"hi"}',
        aiService: aiService as unknown as any,
        maxTokens: 100,
        providerOptions: {
          enableBookending: false,
          useFewShot: false,
          useSeedFromConfig: false,
          enableLogprobs: false,
        },
      });

      expect(result.text).toBe('from content');
      expect(result.metadata?.provider).toBe('test');
    });
  });

  describe('edge cases', () => {
    it('adds few-shot messages and enables sandwich prompting', async () => {
      const aiService = { execute: vi.fn().mockResolvedValue({ text: 'ok' }) };

      await callModel({
        systemPrompt: 'sys',
        userPayload: '{"text":"hi"}',
        aiService: aiService as unknown as any,
        maxTokens: 100,
        providerOptions: {
          enableBookending: false,
          useFewShot: true,
          useSeedFromConfig: true,
          enableLogprobs: false,
          providerName: 'groq',
        },
      });

      const [, params] = (aiService.execute as ReturnType<typeof vi.fn>).mock.calls[0] || [];
      expect(params.enableSandwich).toBe(true);
      expect(params.messages).toHaveLength(3);
      expect(params.messages[1].content).toBe('example');
    });
  });

  describe('core behavior', () => {
    it('disables jsonMode when schema is provided and forwards developerMessage', async () => {
      const aiService = { execute: vi.fn().mockResolvedValue({ text: 'ok' }) };

      await callModel({
        systemPrompt: 'sys',
        userPayload: '{"text":"hi"}',
        aiService: aiService as unknown as any,
        maxTokens: 200,
        providerOptions: {
          enableBookending: true,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: true,
          developerMessage: 'dev',
        },
        schema: { type: 'object' },
      });

      const [, params] = (aiService.execute as ReturnType<typeof vi.fn>).mock.calls[0] || [];
      expect(params.jsonMode).toBe(false);
      expect(params.schema).toEqual({ type: 'object' });
      expect(params.developerMessage).toBe('dev');
    });
  });
});
