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
      const responseFormat = payload.response_format as
        | {
            type?: string;
            json_schema?: {
              name?: string;
              strict?: boolean;
              schema?: Record<string, unknown>;
            };
          }
        | undefined;

      expect(responseFormat?.type).toBe('json_schema');
      expect(responseFormat?.json_schema?.name).toBe('structured_response');
      expect(responseFormat?.json_schema?.strict).toBe(true);
      expect(payload.frequency_penalty).toBe(0);
      expect(payload.temperature).toBe(0);
      expect(payload.top_p).toBe(1);
      expect(payload.seed).toBe(hashString(systemPrompt) % 2147483647);
    });

    it('uses schema-provided name and unwraps wrapper schemas for OpenAI response format', () => {
      const payload = builder.buildPayload('Return strict JSON output.', {
        schema: {
          name: 'judge_response',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              scores: {
                type: 'object',
                properties: {
                  coverage: { type: 'number' },
                },
                required: ['coverage'],
              },
            },
            required: ['scores'],
          },
        },
      });

      const responseFormat = payload.response_format as {
        type: string;
        json_schema: {
          name: string;
          strict: boolean;
          schema: Record<string, unknown>;
        };
      };

      expect(responseFormat.type).toBe('json_schema');
      expect(responseFormat.json_schema.name).toBe('judge_response');
      expect(responseFormat.json_schema.strict).toBe(true);
      expect(responseFormat.json_schema.schema.name).toBeUndefined();
      expect(responseFormat.json_schema.schema.strict).toBeUndefined();
      expect(responseFormat.json_schema.schema.additionalProperties).toBe(false);
      expect(responseFormat.json_schema.schema.properties).toEqual(
        expect.objectContaining({
          scores: expect.objectContaining({
            additionalProperties: false,
          }),
        })
      );
    });
  });
});
