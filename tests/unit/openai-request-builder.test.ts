import { describe, it, expect } from 'vitest';

import { OpenAiRequestBuilder } from '@server/clients/adapters/openai/OpenAiRequestBuilder';
import { OpenAiMessageBuilder } from '@server/clients/adapters/openai/OpenAiMessageBuilder';

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

describe('OpenAiRequestBuilder', () => {
  const builder = new OpenAiRequestBuilder(new OpenAiMessageBuilder(), {
    defaultModel: 'gpt-test',
    supportsPredictedOutputs: true,
  });

  describe('error handling', () => {
    it('omits logprobs when streaming', () => {
      const payload = builder.buildPayload('System prompt', {
        logprobs: true,
        topLogprobs: 5,
      }, true);

      expect(payload.stream).toBe(true);
      expect(payload.logprobs).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('caps top_logprobs to 20', () => {
      const payload = builder.buildPayload('System prompt', {
        logprobs: true,
        topLogprobs: 50,
      });

      expect(payload.logprobs).toBe(true);
      expect(payload.top_logprobs).toBe(20);
    });

    it('injects stream options when streaming', () => {
      const payload = builder.buildPayload('System prompt', {
        streamOptions: { include_usage: true },
      }, true);

      expect(payload.stream_options).toEqual({ include_usage: true });
    });
  });

  describe('core behavior', () => {
    it('builds structured output payloads with deterministic seed', () => {
      const systemPrompt = 'Respond only with valid JSON.';
      const payload = builder.buildPayload(systemPrompt, {
        schema: { type: 'object' },
      });

      expect(payload.response_format?.type).toBe('json_schema');
      expect(payload.frequency_penalty).toBe(0);
      expect(payload.temperature).toBe(0);
      expect(payload.top_p).toBe(1);
      expect(payload.seed).toBe(hashString(systemPrompt) % 2147483647);
    });
  });
});
