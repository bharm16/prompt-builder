/**
 * @test {AIModelService}
 * @description Modernized unit tests for the AI model router.
 *
 * Focus on stable invariants:
 * - Operation routing based on ModelConfig
 * - Override behavior
 * - Fallback behavior
 * - Streaming passthrough
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { AIModelService } from '../AIModelService';
import { DEFAULT_CONFIG } from '@config/modelConfig';
import type { IAIClient, AIResponse } from '@interfaces/IAIClient';

describe('AIModelService', () => {
  let service: AIModelService;
  let openaiClient: {
    complete: MockedFunction<IAIClient['complete']>;
    streamComplete: MockedFunction<NonNullable<IAIClient['streamComplete']>>;
  };
  let groqClient: {
    complete: MockedFunction<IAIClient['complete']>;
    streamComplete: MockedFunction<NonNullable<IAIClient['streamComplete']>>;
  };
  let qwenClient: {
    complete: MockedFunction<IAIClient['complete']>;
    streamComplete: MockedFunction<NonNullable<IAIClient['streamComplete']>>;
  };

  const makeResponse = (text = 'ok'): AIResponse => ({
    text,
    metadata: {},
  });

  beforeEach(() => {
    openaiClient = {
      complete: vi.fn(),
      streamComplete: vi.fn(),
    };
    groqClient = {
      complete: vi.fn(),
      streamComplete: vi.fn(),
    };
    qwenClient = {
      complete: vi.fn(),
      streamComplete: vi.fn(),
    };

    service = new AIModelService({
      clients: {
        openai: openaiClient as IAIClient,
        groq: groqClient as IAIClient,
        qwen: qwenClient as IAIClient,
      },
    });
  });

  describe('execute', () => {
    it('routes to the configured client and passes config defaults', async () => {
      const config = service.getOperationConfig('optimize_standard');
      const clientByName: Record<string, typeof openaiClient> = {
        openai: openaiClient,
        groq: groqClient,
        qwen: qwenClient,
      };
      const primary = clientByName[config.client] ?? openaiClient;

      primary.complete.mockResolvedValue(makeResponse('standard'));

      const result = await service.execute('optimize_standard', {
        systemPrompt: 'sys',
        userMessage: 'hi',
      });

      expect(primary.complete).toHaveBeenCalledTimes(1);
      expect(primary.complete).toHaveBeenCalledWith(
        'sys',
        expect.objectContaining({
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          timeout: config.timeout,
        })
      );
      expect(result.text).toBe('standard');
    });

    it('allows caller to override config values', async () => {
      openaiClient.complete.mockResolvedValue(makeResponse('override'));

      await service.execute('optimize_standard', {
        systemPrompt: 'sys',
        temperature: 0.5,
        maxTokens: 123,
      });

      expect(openaiClient.complete).toHaveBeenCalledWith(
        'sys',
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 123,
        })
      );
    });

    it('uses DEFAULT_CONFIG for unknown operations', async () => {
      openaiClient.complete.mockResolvedValue(makeResponse('default'));

      await service.execute('unknown_operation', {
        systemPrompt: 'sys',
      });

      expect(openaiClient.complete).toHaveBeenCalledWith(
        'sys',
        expect.objectContaining({
          model: DEFAULT_CONFIG.model,
          temperature: DEFAULT_CONFIG.temperature,
          maxTokens: DEFAULT_CONFIG.maxTokens,
          timeout: DEFAULT_CONFIG.timeout,
        })
      );
    });

    it('falls back when primary client fails and fallback is available', async () => {
      const config = service.getOperationConfig('optimize_standard');
      expect(config.fallbackTo).toBeDefined();

      const clientByName: Record<string, typeof openaiClient> = {
        openai: openaiClient,
        groq: groqClient,
        qwen: qwenClient,
      };
      const primary = clientByName[config.client] ?? openaiClient;
      const fallback = (config.fallbackTo ? clientByName[config.fallbackTo] : null) ?? openaiClient;

      primary.complete.mockRejectedValue(new Error('primary failed'));
      fallback.complete.mockResolvedValue(makeResponse('fallback'));

      const result = await service.execute('optimize_standard', {
        systemPrompt: 'sys',
      });

      expect(primary.complete).toHaveBeenCalledTimes(1);
      expect(fallback.complete).toHaveBeenCalledTimes(1);
      expect(result.text).toBe('fallback');
    });
  });

  describe('stream', () => {
    it('streams through a streaming-capable client', async () => {
      const config = service.getOperationConfig('enhance_suggestions');
      const clientByName: Record<string, typeof openaiClient> = {
        openai: openaiClient,
        groq: groqClient,
        qwen: qwenClient,
      };
      const client = clientByName[config.client] ?? openaiClient;

      const chunks = ['a', 'b', 'c'];
      client.streamComplete.mockImplementation(async (_sys, options) => {
        for (const chunk of chunks) {
          options.onChunk(chunk);
        }
        return chunks.join('');
      });

      const onChunk = vi.fn();

      const text = await service.stream('enhance_suggestions', {
        systemPrompt: 'sys',
        userMessage: 'hi',
        onChunk,
      });

      expect(text).toBe('abc');
      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(client.streamComplete).toHaveBeenCalledWith(
        'sys',
        expect.objectContaining({
          model: config.model,
          onChunk,
        })
      );
    });

    it('throws when onChunk is missing', async () => {
      await expect(
        service.stream('enhance_suggestions', {
          systemPrompt: 'sys',
        } as unknown as Parameters<AIModelService['stream']>[1])
      ).rejects.toThrow('Streaming requires onChunk');
    });
  });
});
