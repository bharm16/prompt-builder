import { describe, it, expect } from 'vitest';

import { OpenAiResponseParser } from '@server/clients/adapters/openai/OpenAiResponseParser';

describe('OpenAiResponseParser', () => {
  describe('edge cases', () => {
    it('computes logprob confidence when provided', () => {
      const parser = new OpenAiResponseParser('openai');
      const result = parser.parseResponse(
        {
          choices: [
            {
              message: { content: 'Hello' },
              logprobs: {
                content: [
                  { token: 'Hello', logprob: 0 },
                  { token: 'world', logprob: Math.log(0.25) },
                ],
              },
              finish_reason: 'stop',
            },
          ],
          model: 'gpt-test',
        },
        { logprobs: true }
      );

      expect(result.metadata?.logprobs).toHaveLength(2);
      expect(result.metadata?.averageConfidence).toBeCloseTo(0.625, 5);
      expect(result.metadata?.finishReason).toBe('stop');
    });
  });

  describe('core behavior', () => {
    it('adds optimization tags based on options', () => {
      const parser = new OpenAiResponseParser('openai');
      const result = parser.parseResponse(
        {
          choices: [{ message: { content: 'ok' } }],
          model: 'gpt-test',
          id: 'req-1',
        },
        {
          schema: { type: 'object' },
          developerMessage: 'Use JSON',
          enableBookending: true,
          seed: 42,
          logprobs: true,
          prediction: { type: 'content', content: 'predict' },
        }
      );

      expect(result.metadata?.optimizations).toEqual(
        expect.arrayContaining([
          'structured-outputs-strict',
          'developer-role',
          'bookending',
          'seed-deterministic',
          'logprobs-confidence',
          'predicted-outputs',
        ])
      );
      expect(result.metadata?.provider).toBe('openai');
      expect(result.metadata?.model).toBe('gpt-test');
      expect(result.metadata?.requestId).toBe('req-1');
    });
  });
});
