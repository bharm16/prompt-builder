import { describe, it, expect, vi } from 'vitest';
import { ReadableStream } from 'stream/web';

import { OpenAiStreamParser } from '@server/clients/adapters/openai/OpenAiStreamParser';

const { logSpies } = vi.hoisted(() => ({
  logSpies: {
    debug: vi.fn(),
  },
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: logSpies,
}));

const createStreamResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(stream);
};

describe('OpenAiStreamParser', () => {
  describe('error handling', () => {
    it('throws when the response body is not readable', async () => {
      const parser = new OpenAiStreamParser();
      const response = { body: null } as Response;

      await expect(parser.readStream(response, () => {})).rejects.toThrow(
        'Response body is not readable'
      );
    });
  });

  describe('edge cases', () => {
    it('skips malformed chunks without breaking the stream', async () => {
      const parser = new OpenAiStreamParser();
      const chunks = [
        'data: {not-json}\n',
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
        'data: [DONE]\n',
      ];
      const response = createStreamResponse(chunks);
      const onChunk = vi.fn();

      const result = await parser.readStream(response, onChunk);

      expect(result).toBe('Hi');
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith('Hi');
    });
  });

  describe('core behavior', () => {
    it('parses SSE chunks and emits content', async () => {
      const parser = new OpenAiStreamParser();
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello "}}]}\n',
        'data: {"choices":[{"delta":{"content":"world"}}]}\n',
        'data: [DONE]\n',
      ];
      const response = createStreamResponse(chunks);
      const onChunk = vi.fn();

      const result = await parser.readStream(response, onChunk);

      expect(result).toBe('Hello world');
      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenCalledWith('Hello ');
      expect(onChunk).toHaveBeenCalledWith('world');
    });
  });
});
