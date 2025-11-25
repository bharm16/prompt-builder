import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GroqAPIClient, APIError, TimeoutError, ServiceUnavailableError } from '../GroqAPIClient.js';

// Mock external dependencies
vi.mock('../../infrastructure/Logger.ts', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/MetricsService.js', () => ({
  metricsService: {
    updateCircuitBreakerState: vi.fn(),
    recordClaudeAPICall: vi.fn(),
  },
}));

// Mock opossum circuit breaker
vi.mock('opossum', () => {
  return {
    default: class MockCircuitBreaker {
      constructor(fn, options) {
        this.fn = fn;
        this.options = options;
        this.opened = false;
        this.halfOpen = false;
        this.stats = {
          fires: 0,
          failures: 0,
          successes: 0,
        };
        this._eventHandlers = {};
      }

      async fire(...args) {
        this.stats.fires++;
        try {
          const result = await this.fn(...args);
          this.stats.successes++;
          return result;
        } catch (error) {
          this.stats.failures++;
          throw error;
        }
      }

      on(event, handler) {
        this._eventHandlers[event] = handler;
      }

      _triggerEvent(event) {
        if (this._eventHandlers[event]) {
          this._eventHandlers[event]();
        }
      }
    },
  };
});

describe('GroqAPIClient', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    client = new GroqAPIClient('test-groq-api-key', {
      model: 'llama-3.1-8b-instant',
      timeout: 5000,
    });
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new GroqAPIClient('test-key');

      expect(defaultClient.apiKey).toBe('test-key');
      expect(defaultClient.baseURL).toBe('https://api.groq.com/openai/v1');
      expect(defaultClient.model).toBe('llama-3.1-8b-instant');
      expect(defaultClient.defaultTimeout).toBe(5000);
    });

    it('should initialize with custom configuration', () => {
      const customClient = new GroqAPIClient('custom-key', {
        model: 'llama-3.1-70b-versatile',
        timeout: 10000,
      });

      expect(customClient.model).toBe('llama-3.1-70b-versatile');
      expect(customClient.defaultTimeout).toBe(10000);
    });

    it('should initialize circuit breaker with lenient settings for fast API', () => {
      expect(client.breaker).toBeDefined();
      expect(client.breaker.options.errorThresholdPercentage).toBe(60);
      expect(client.breaker.options.resetTimeout).toBe(15000);
      expect(client.breaker.options.name).toBe('groq-api');
    });
  });

  describe('Non-Streaming Completion', () => {
    it('should make successful API request and transform to Claude format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Generated draft response',
              },
            },
          ],
        }),
      });

      const result = await client.complete('System prompt', {
        maxTokens: 500,
        userMessage: 'User message',
      });

      // Verify Claude-compatible format
      expect(result.content).toEqual([
        {
          text: 'Generated draft response',
        },
      ]);
      expect(result._original).toBeDefined();
    });

    it('should send correct request payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('System prompt', {
        maxTokens: 500,
        userMessage: 'User message',
        temperature: 0.5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-groq-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toEqual({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User message' },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });
    });

    it('should use default values when options not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('System prompt');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[1].content).toBe('Please proceed.');
      expect(body.max_tokens).toBe(500);
      expect(body.temperature).toBe(0.7);
    });

    it('should handle empty response content gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      });

      const result = await client.complete('System prompt');

      expect(result.content[0].text).toBe('');
    });

    it('should handle missing choice gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      const result = await client.complete('System prompt');

      expect(result.content[0].text).toBe('');
    });
  });

  describe('Error Handling - Authentication', () => {
    it('should provide helpful error for invalid API key (code-based)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: {
              code: 'invalid_api_key',
              message: 'Invalid API key',
            },
          }),
      });

      await expect(client.complete('Test')).rejects.toThrow(APIError);
      await expect(client.complete('Test')).rejects.toThrow(
        /Invalid Groq API key.*GROQ_API_KEY.*https:\/\/console\.groq\.com/
      );
    });

    it('should provide helpful error for authentication failure (generic)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Auth failed' } }),
      });

      await expect(client.complete('Test')).rejects.toThrow(
        /Groq API authentication failed.*https:\/\/console\.groq\.com/
      );
    });

    it('should include status code in APIError', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      try {
        await client.complete('Test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.statusCode).toBe(401);
      }
    });
  });

  describe('Error Handling - Rate Limiting', () => {
    it('should provide clear error message for rate limits', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Rate limited' } }),
      });

      await expect(client.complete('Test')).rejects.toThrow(
        /Groq API rate limit exceeded/
      );
    });
  });

  describe('Error Handling - Server Errors', () => {
    it('should provide clear error message for server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(client.complete('Test')).rejects.toThrow(
        /Groq API server error.*temporarily unavailable/
      );
    });
  });

  describe('Error Handling - Timeouts', () => {
    it('should throw TimeoutError when request times out', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const shortTimeoutClient = new GroqAPIClient('test-key', {
        timeout: 100,
      });

      await expect(shortTimeoutClient.complete('Test')).rejects.toThrow(TimeoutError);
      await expect(shortTimeoutClient.complete('Test')).rejects.toThrow(
        /timeout after 100ms/
      );
    });

    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('Test');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Error Handling - Non-JSON Errors', () => {
    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service temporarily unavailable',
      });

      await expect(client.complete('Test')).rejects.toThrow(APIError);
      await expect(client.complete('Test')).rejects.toThrow(
        /Groq API error: 503/
      );
    });
  });

  describe('Streaming Completion', () => {
    // Helper to create SSE stream chunks
    function createSSEChunks(texts) {
      const chunks = texts.map(text =>
        `data: ${JSON.stringify({
          choices: [{ delta: { content: text } }],
        })}\n\n`
      );
      chunks.push('data: [DONE]\n\n');
      return chunks.join('');
    }

    function createMockStreamReader(content) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      let position = 0;

      return {
        read: async () => {
          if (position >= data.length) {
            return { done: true, value: undefined };
          }
          // Read in chunks to simulate streaming
          const chunkSize = Math.min(50, data.length - position);
          const chunk = data.slice(position, position + chunkSize);
          position += chunkSize;
          return { done: false, value: chunk };
        },
      };
    }

    it('should require onChunk callback for streaming', async () => {
      await expect(client.streamComplete('Test', {})).rejects.toThrow(
        'onChunk callback is required for streaming'
      );
    });

    it('should stream chunks and call onChunk for each piece', async () => {
      const chunks = [];
      const onChunk = vi.fn((chunk) => chunks.push(chunk));

      const sseContent = createSSEChunks(['Hello', ' ', 'world', '!']);

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      const fullText = await client.streamComplete('System prompt', {
        onChunk,
        userMessage: 'Generate text',
        maxTokens: 500,
        temperature: 0.7,
      });

      expect(fullText).toBe('Hello world!');
      expect(onChunk).toHaveBeenCalledTimes(4);
      expect(chunks).toEqual(['Hello', ' ', 'world', '!']);
    });

    it('should send correct streaming request payload', async () => {
      const onChunk = vi.fn();
      const sseContent = createSSEChunks(['Response']);

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      await client.streamComplete('System prompt', {
        onChunk,
        userMessage: 'User message',
        maxTokens: 1000,
        temperature: 0.5,
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User message' },
        ],
        max_tokens: 1000,
        temperature: 0.5,
        stream: true,
      });
    });

    it('should skip malformed SSE chunks gracefully', async () => {
      const onChunk = vi.fn();

      // Mix valid and invalid JSON in SSE stream
      const sseContent =
        'data: {"choices":[{"delta":{"content":"Valid"}]}\n\n' +
        'data: {invalid json}\n\n' +  // Malformed JSON
        'data: {"choices":[{"delta":{"content":"Also valid"}}]}\n\n' +
        'data: [DONE]\n\n';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      const fullText = await client.streamComplete('Test', { onChunk });

      // Should only include valid chunks
      expect(fullText).toBe('ValidAlso valid');
      expect(onChunk).toHaveBeenCalledTimes(2);
    });

    it('should handle empty delta content in SSE chunks', async () => {
      const onChunk = vi.fn();

      const sseContent =
        'data: {"choices":[{"delta":{"content":"Text"}}]}\n\n' +
        'data: {"choices":[{"delta":{}}]}\n\n' +  // Empty delta
        'data: {"choices":[{"delta":{"content":"More"}}]}\n\n' +
        'data: [DONE]\n\n';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      const fullText = await client.streamComplete('Test', { onChunk });

      expect(fullText).toBe('TextMore');
      expect(onChunk).toHaveBeenCalledTimes(2); // Only chunks with content
    });

    it('should handle [DONE] marker correctly', async () => {
      const onChunk = vi.fn();

      const sseContent =
        'data: {"choices":[{"delta":{"content":"Complete"}}]}\n\n' +
        'data: [DONE]\n\n';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      const fullText = await client.streamComplete('Test', { onChunk });

      expect(fullText).toBe('Complete');
      // [DONE] should not trigger onChunk
      expect(onChunk).toHaveBeenCalledTimes(1);
    });

    it('should handle multi-line SSE chunks correctly', async () => {
      const onChunk = vi.fn();

      // SSE stream with multiple events in one chunk
      const sseContent =
        'data: {"choices":[{"delta":{"content":"First"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"Second"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"Third"}}]}\n\n' +
        'data: [DONE]\n\n';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      const fullText = await client.streamComplete('Test', { onChunk });

      expect(fullText).toBe('FirstSecondThird');
      expect(onChunk).toHaveBeenCalledTimes(3);
    });

    it('should ignore empty lines in SSE stream', async () => {
      const onChunk = vi.fn();

      const sseContent =
        '\n\n' +  // Empty lines
        'data: {"choices":[{"delta":{"content":"Text"}}]}\n\n' +
        '\n' +
        'data: [DONE]\n\n';

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      const fullText = await client.streamComplete('Test', { onChunk });

      expect(fullText).toBe('Text');
    });

    it('should handle streaming timeout', async () => {
      const onChunk = vi.fn();

      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      await expect(
        client.streamComplete('Test', {
          onChunk,
          timeout: 100,
        })
      ).rejects.toThrow(TimeoutError);
    });

    it('should handle streaming API errors with helpful messages', async () => {
      const onChunk = vi.fn();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: {
              code: 'invalid_api_key',
            },
          }),
      });

      await expect(
        client.streamComplete('Test', { onChunk })
      ).rejects.toThrow(/Invalid Groq API key/);
    });

    it('should clear timeout on successful stream completion', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const onChunk = vi.fn();
      const sseContent = createSSEChunks(['Done']);

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => createMockStreamReader(sseContent),
        },
      });

      await client.streamComplete('Test', { onChunk });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout on streaming error', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const onChunk = vi.fn();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      await expect(client.streamComplete('Test', { onChunk })).rejects.toThrow();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should trigger circuit breaker events', () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');

      client.breaker._triggerEvent('open');
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'groq-api',
        'open'
      );

      client.breaker._triggerEvent('halfOpen');
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'groq-api',
        'half-open'
      );

      client.breaker._triggerEvent('close');
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'groq-api',
        'closed'
      );
    });

    it('should throw ServiceUnavailableError when circuit breaker is open', async () => {
      client.breaker.opened = true;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await expect(client.complete('Test')).rejects.toThrow(ServiceUnavailableError);
      await expect(client.complete('Test')).rejects.toThrow(
        'Groq API is currently unavailable'
      );
    });

    it('should return correct circuit breaker state', () => {
      expect(client.getCircuitBreakerState()).toBe('CLOSED');

      client.breaker.opened = true;
      expect(client.getCircuitBreakerState()).toBe('OPEN');

      client.breaker.opened = false;
      client.breaker.halfOpen = true;
      expect(client.getCircuitBreakerState()).toBe('HALF-OPEN');
    });
  });

  describe('Metrics Recording', () => {
    it('should record successful API calls', async () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('Test');

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'groq-chat/completions',
        expect.any(Number),
        true
      );
    });

    it('should record failed API calls', async () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      await expect(client.complete('Test')).rejects.toThrow();

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'groq-chat/completions',
        expect.any(Number),
        false
      );
    });

    it('should record successful streaming calls', async () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');
      const onChunk = vi.fn();
      const sseContent = createSSEChunks(['Response']);

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(sseContent);
            let done = false;

            return {
              read: async () => {
                if (done) return { done: true, value: undefined };
                done = true;
                return { done: false, value: data };
              },
            };
          },
        },
      });

      await client.streamComplete('Test', { onChunk });

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'groq-stream',
        expect.any(Number),
        true
      );
    });

    it('should record failed streaming calls', async () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');
      const onChunk = vi.fn();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      await expect(client.streamComplete('Test', { onChunk })).rejects.toThrow();

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'groq-stream',
        expect.any(Number),
        false
      );
    });
  });

  describe('Health Check', () => {
    it('should return healthy status on successful check', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'healthy' } }],
        }),
      });

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.circuitBreakerState).toBe('CLOSED');
    });

    it('should return unhealthy status on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      });

      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.circuitBreakerState).toBe('CLOSED');
    });

    it('should use short timeout and minimal tokens for health checks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'healthy' } }],
        }),
      });

      await client.healthCheck();

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.max_tokens).toBe(10);
    });
  });

  describe('Statistics', () => {
    it('should return circuit breaker statistics', () => {
      const stats = client.getStats();

      expect(stats.state).toBe('CLOSED');
      expect(stats.stats).toBeDefined();
      expect(stats.stats).toHaveProperty('fires');
      expect(stats.stats).toHaveProperty('successes');
      expect(stats.stats).toHaveProperty('failures');
    });

    it('should update statistics after successful request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('Test');

      const stats = client.getStats();
      expect(stats.stats.fires).toBe(1);
      expect(stats.stats.successes).toBe(1);
      expect(stats.stats.failures).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle custom model override', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('Test', { model: 'llama-3.1-70b-versatile' });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('llama-3.1-70b-versatile');
    });

    it('should handle temperature of 0', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete('Test', { temperature: 0 });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.temperature).toBe(0);
    });

    it('should handle very long system prompts', async () => {
      const longPrompt = 'a'.repeat(10000);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      await client.complete(longPrompt);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].content).toBe(longPrompt);
    });

    it('should handle streaming with very small chunks', async () => {
      const onChunk = vi.fn();
      const sseContent = createSSEChunks(['H', 'e', 'l', 'l', 'o']);

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(sseContent);
            let position = 0;

            return {
              read: async () => {
                if (position >= data.length) {
                  return { done: true, value: undefined };
                }
                // Read 1 byte at a time to test chunking logic
                const chunk = data.slice(position, position + 1);
                position += 1;
                return { done: false, value: chunk };
              },
            };
          },
        },
      });

      const fullText = await client.streamComplete('Test', { onChunk });

      expect(fullText).toBe('Hello');
      expect(onChunk).toHaveBeenCalledTimes(5);
    });
  });
});

// Helper function for tests
function createSSEChunks(texts) {
  const chunks = texts.map(text =>
    `data: ${JSON.stringify({
      choices: [{ delta: { content: text } }],
    })}\n\n`
  );
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}
