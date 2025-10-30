import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OpenAIAPIClient,
  APIError,
  TimeoutError,
  ServiceUnavailableError,
} from '../../../../server/src/clients/OpenAIAPIClient.js';

// Mock external dependencies
vi.mock('../../../../server/src/infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../server/src/infrastructure/MetricsService.js', () => ({
  metricsService: {
    recordClaudeAPICall: vi.fn(),
    updateCircuitBreakerState: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/ConcurrencyLimiter.js', () => ({
  openAILimiter: {
    execute: vi.fn((fn) => fn()), // By default, just execute the function
    getQueueStatus: vi.fn(() => ({
      running: 0,
      queued: 0,
    })),
    getStats: vi.fn(() => ({
      completed: 0,
      failed: 0,
      queued: 0,
    })),
  },
}));

// Mock fetch
global.fetch = vi.fn();

import { logger } from '../../../../server/src/infrastructure/Logger.js';
import { metricsService } from '../../../../server/src/infrastructure/MetricsService.js';
import { openAILimiter } from '../../../../server/src/utils/ConcurrencyLimiter.js';

describe('OpenAIAPIClient', () => {
  let client;
  const apiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();

    // Don't use fake timers by default - they interfere with circuit breaker
    // Only use them in specific tests that need them

    client = new OpenAIAPIClient(apiKey);

    // Reset limiter mock to default behavior
    openAILimiter.execute.mockImplementation((fn) => fn());
  });

  afterEach(() => {
    // Clean up any timers
    vi.clearAllTimers();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(client.apiKey).toBe(apiKey);
      expect(client.baseURL).toBe('https://api.openai.com/v1');
      expect(client.model).toBe('gpt-4o-mini');
      expect(client.defaultTimeout).toBe(60000);
    });

    it('should accept custom model configuration', () => {
      const customClient = new OpenAIAPIClient(apiKey, {
        model: 'gpt-4',
      });

      expect(customClient.model).toBe('gpt-4');
    });

    it('should accept custom timeout configuration', () => {
      const customClient = new OpenAIAPIClient(apiKey, {
        timeout: 30000,
      });

      expect(customClient.defaultTimeout).toBe(30000);
    });

    it('should initialize circuit breaker', () => {
      expect(client.breaker).toBeDefined();
      expect(client.getCircuitBreakerState()).toBe('CLOSED');
    });

    it('should set initial circuit breaker state metrics', () => {
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'openai-api',
        'closed'
      );
    });
  });

  describe('complete - Happy Path', () => {
    it('should make successful API call and transform response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is the response from OpenAI',
            },
          },
        ],
        usage: { total_tokens: 100 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.complete('Test prompt');

      expect(result).toEqual({
        content: [
          {
            text: 'This is the response from OpenAI',
          },
        ],
        _original: mockResponse,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should pass system prompt and user message correctly', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('System prompt', {
        userMessage: 'Custom user message',
      });

      const fetchCall = global.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.messages).toEqual([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Custom user message' },
      ]);
    });

    it('should use default user message if not provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('System prompt');

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);

      expect(body.messages[1].content).toBe('Please proceed.');
    });

    it('should pass model option to API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('Test', { model: 'gpt-4' });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);

      expect(body.model).toBe('gpt-4');
    });

    it('should pass maxTokens option to API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('Test', { maxTokens: 2000 });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);

      expect(body.max_tokens).toBe(2000);
    });

    it('should pass temperature option to API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('Test', { temperature: 0.5 });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);

      expect(body.temperature).toBe(0.5);
    });

    it('should record successful API call metrics', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('Test');

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'chat/completions',
        expect.any(Number),
        true
      );
    });
  });

  describe('complete - Error Handling', () => {
    it('should throw APIError on non-200 response', async () => {
      // Use fresh client to avoid circuit breaker state from other tests
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(freshClient.complete('Test')).rejects.toThrow(APIError);
    });

    it('should throw APIError with status code', async () => {
      // Use fresh client to avoid circuit breaker state
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      try {
        await freshClient.complete('Test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.statusCode).toBe(429);
      }
    });

    it('should throw TimeoutError on request timeout', async () => {
      // Use fresh client to avoid circuit breaker state
      const freshClient = new OpenAIAPIClient(apiKey);

      // Mock fetch to take too long
      global.fetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              json: async () => ({ choices: [{ message: { content: 'late' } }] }),
            }), 2000);
          })
      );

      await expect(
        freshClient.complete('Test', { timeout: 100 })
      ).rejects.toThrow(TimeoutError);
    }, 15000); // Increase test timeout

    it('should throw ServiceUnavailableError when circuit breaker is open', async () => {
      // Simulate enough failures to open the circuit breaker
      // Circuit breaker opens at 50% error rate
      global.fetch.mockRejectedValue(new Error('Network error'));

      // Make multiple failing calls to open the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await client.complete('Test');
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify circuit breaker opened
      expect(client.breaker.opened).toBe(true);

      // Next call should throw ServiceUnavailableError
      await expect(client.complete('Test')).rejects.toThrow(
        ServiceUnavailableError
      );
    });

    it('should handle queue timeout errors', async () => {
      const queueError = new Error('Queue timeout');
      queueError.code = 'QUEUE_TIMEOUT';

      openAILimiter.execute.mockRejectedValueOnce(queueError);

      await expect(client.complete('Test')).rejects.toThrow(TimeoutError);
      await expect(client.complete('Test')).rejects.toThrow(/timed out in queue/);
    });

    it('should handle cancelled requests', async () => {
      const cancelError = new Error('Cancelled');
      cancelError.code = 'CANCELLED';

      openAILimiter.execute.mockRejectedValueOnce(cancelError);

      await expect(client.complete('Test')).rejects.toThrow('Cancelled');
    });

    it('should record failed API call metrics', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await freshClient.complete('Test');
      } catch (error) {
        // Expected
      }

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'chat/completions',
        expect.any(Number),
        false
      );
    });
  });

  describe('Response Transformation', () => {
    it('should transform OpenAI response to Claude format', async () => {
      const openAIResponse = {
        choices: [
          {
            message: {
              content: 'OpenAI response text',
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => openAIResponse,
      });

      const result = await client.complete('Test');

      // Should match Claude's response format
      expect(result).toHaveProperty('content');
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content[0]).toHaveProperty('text');
      expect(result.content[0].text).toBe('OpenAI response text');
    });

    it('should handle empty response content gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      const result = await client.complete('Test');

      expect(result.content[0].text).toBe('');
    });

    it('should include original response for debugging', async () => {
      const openAIResponse = {
        choices: [{ message: { content: 'text' } }],
        usage: { total_tokens: 50 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => openAIResponse,
      });

      const result = await client.complete('Test');

      expect(result._original).toEqual(openAIResponse);
    });
  });

  describe('Circuit Breaker', () => {
    it('should start in CLOSED state', () => {
      expect(client.getCircuitBreakerState()).toBe('CLOSED');
    });

    it('should emit circuit breaker state changes', async () => {
      // Force circuit to open by causing failures
      global.fetch.mockRejectedValue(new Error('Failure'));

      for (let i = 0; i < 10; i++) {
        try {
          await client.complete('Test');
        } catch (error) {
          // Expected
        }
      }

      // Should have logged circuit breaker opening
      expect(logger.error).toHaveBeenCalledWith(
        'Circuit breaker OPEN - OpenAI API failing'
      );
    });

    it('should track circuit breaker stats', () => {
      const stats = client.getStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('stats');
      expect(['OPEN', 'HALF-OPEN', 'CLOSED']).toContain(stats.state);
    });
  });

  describe('Concurrency Limiting', () => {
    it('should execute requests through concurrency limiter', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('Test');

      expect(openAILimiter.execute).toHaveBeenCalled();
    });

    it('should pass signal and priority options to limiter', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      const signal = new AbortController().signal;

      await client.complete('Test', { signal, priority: true });

      expect(openAILimiter.execute).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          signal,
          priority: true,
        })
      );
    });

    it('should get queue status', () => {
      const status = client.getQueueStatus();

      expect(status).toBeDefined();
      expect(openAILimiter.getQueueStatus).toHaveBeenCalled();
    });

    it('should get concurrency stats', () => {
      const stats = client.getConcurrencyStats();

      expect(stats).toBeDefined();
      expect(openAILimiter.getStats).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on successful check', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'healthy' } }],
        }),
      });

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.circuitBreakerState).toBe('CLOSED');
    });

    it('should use minimal tokens for health check', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'healthy' } }],
        }),
      });

      await client.healthCheck();

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);

      expect(body.max_tokens).toBe(10);
    });

    it('should use short timeout for health check', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              json: async () => ({ choices: [{ message: { content: 'late' } }] }),
            }), 6000);
          })
      );

      const health = await freshClient.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    }, 15000); // Increase test timeout

    it('should return unhealthy status on error', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockRejectedValueOnce(new Error('Connection failed'));

      const health = await freshClient.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined(); // May be wrapped by circuit breaker
      expect(health.circuitBreakerState).toBeDefined();
    });
  });

  describe('Error Classes', () => {
    it('should create APIError with status code', () => {
      const error = new APIError('Test error', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('APIError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
    });

    it('should create TimeoutError', () => {
      const error = new TimeoutError('Timeout occurred');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Timeout occurred');
    });

    it('should create ServiceUnavailableError', () => {
      const error = new ServiceUnavailableError('Service down');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.message).toBe('Service down');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty system prompt', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      const result = await client.complete('');

      expect(result).toBeDefined();
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toBe('');
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'word '.repeat(10000);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      const result = await client.complete(longPrompt);

      expect(result).toBeDefined();
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toBe(longPrompt);
    });

    it('should handle temperature = 0', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      await client.complete('Test', { temperature: 0 });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);

      expect(body.temperature).toBe(0);
    });

    it('should handle malformed JSON response', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(freshClient.complete('Test')).rejects.toThrow('Invalid JSON');
    });

    it('should clean up timeout even on error', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      global.fetch.mockRejectedValueOnce(new Error('Fetch failed'));

      try {
        await client.complete('Test');
      } catch (error) {
        // Expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should handle fetch network errors', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(freshClient.complete('Test')).rejects.toThrow('Network failure');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle rate limit error gracefully', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      try {
        await freshClient.complete('Test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.statusCode).toBe(429);
        expect(error.message).toContain('Rate limit');
      }
    });

    it('should handle authentication errors', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      try {
        await freshClient.complete('Test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.statusCode).toBe(401);
      }
    });

    it('should handle server errors with retry through circuit breaker', async () => {
      // Use fresh client
      const freshClient = new OpenAIAPIClient(apiKey);

      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'success' } }],
          }),
        });

      // First call fails
      await expect(freshClient.complete('Test')).rejects.toThrow(APIError);

      // Circuit is still closed, retry succeeds
      const result = await freshClient.complete('Test');
      expect(result.content[0].text).toBe('success');
    });

    it('should work with different OpenAI models', async () => {
      const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];

      for (const model of models) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: `Response from ${model}` } }],
          }),
        });

        await client.complete('Test', { model });

        const body = JSON.parse(
          global.fetch.mock.calls[global.fetch.mock.calls.length - 1][1].body
        );
        expect(body.model).toBe(model);
      }
    });
  });
});
